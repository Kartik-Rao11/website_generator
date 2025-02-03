import { Step, StepType } from './types';
import { XMLParser } from 'fast-xml-parser';

export class StreamXMLParser {
    private parser: XMLParser;
    private accumulatedData: string = '';
    private steps: Map<string, Step> = new Map();
    private processedHashes: Set<string> = new Set();
    private artifactStarted: boolean = false;
    private currentContent: string = '';
    private currentFilePath: string = '';

    constructor(private onStepsUpdate: (steps: Step[]) => void) {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            parseAttributeValue: true,
        });
    }

    public parseChunk(chunk: string): void {
        try {
            const chunkText = JSON.parse(chunk).text;

            // Append incoming text to accumulatedData
            this.accumulatedData += chunkText;

            // Detect the start of a new artifact
            if (chunkText.includes('<boltArtifact') && !this.artifactStarted) {
                this.reset();
                this.artifactStarted = true;
            }

            // Process previous file if a new `<boltAction>` starts
            if (chunkText.includes('<boltAction')) {
                this.processCompleteAction();  // Ensure last file is processed before a new one starts
                this.currentContent = '';      // Reset for next file
                this.currentFilePath = '';
            }

            // Extract file path even if it's split across multiple chunks
            const filePathMatch = this.accumulatedData.match(/filePath="([^"]+)"/);
            if (filePathMatch && !this.currentFilePath) {
                this.currentFilePath = filePathMatch[1];
            }

            // Accumulate file content (ignore <boltAction> and </boltAction>)
            if (this.artifactStarted && this.currentFilePath) {
                if (!chunkText.includes('<boltAction') && !chunkText.includes('</boltAction>')) {
                    this.currentContent += chunkText;
                }
            }

            // Process the file immediately if `</boltAction>` appears
            if (chunkText.includes('</boltAction>')) {
                this.processCompleteAction();
            }

            // Emit steps after every chunk to ensure real-time updates
            this.emitSteps();

            // Detect artifact ending
            if (chunkText.includes('</boltArtifact>')) {
                this.artifactStarted = false;
            }
        } catch (error) {
            console.error('Error processing chunk:', error);
        }
    }

    private processCompleteAction(): void {
        if (this.currentFilePath && this.currentContent.trim()) {
            const fileHash = this.hashString(this.currentFilePath);

            // ✅ Prevent duplicate steps
            if (this.processedHashes.has(fileHash)) return;
            this.processedHashes.add(fileHash);

            const stepId = `file-${fileHash}`;

            const step: Step = {
                id: stepId,
                title: `Create ${this.currentFilePath}`,
                description: `Creating file ${this.currentFilePath}`,
                type: StepType.CreateFile,
                status: 'pending',
                code: this.currentContent.trim(),
                path: this.currentFilePath,
            };

            this.steps.set(stepId, step);
            this.emitSteps();

            // Reset file tracking for the next file
            this.currentFilePath = '';
            this.currentContent = '';
        }
    }

    private emitSteps(): void {
        const newStepsArray = Array.from(this.steps.values());

        // ✅ Prevent excessive state updates
        if (newStepsArray.length === this.steps.size) {
            this.onStepsUpdate(newStepsArray);
        }
    }

    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    public reset(): void {
        this.steps.clear();
        this.processedHashes.clear();
        this.accumulatedData = '';
        this.currentContent = '';
        this.currentFilePath = '';
        this.artifactStarted = false;
    }

    public end(): void {
        console.log("Finalizing last file before closing stream...");

        if (this.currentFilePath && this.currentContent) {
            this.processCompleteAction(); // ✅ Ensures last file is saved
        }

        this.artifactStarted = false;
    }
}

export function createStreamParser(onStepsUpdate: (steps: Step[]) => void): StreamXMLParser {
    return new StreamXMLParser(onStepsUpdate);
}
