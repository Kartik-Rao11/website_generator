import { useState, useEffect } from "react";
import axios from "axios";

export function useStreaming() {
    function startStreaming(url: string, messages: any[], onMessage: (data: string) => void) {
        return new Promise<void>((_resolve, reject) => {
            const transformedMessages = transformMessages(messages);
            const messagesParam = encodeURIComponent(JSON.stringify(transformedMessages));
            const eventSourceUrl = `${url}?messages=${messagesParam}`;
            const eventSource = new EventSource(eventSourceUrl);

            eventSource.onmessage = (event) => {
                console.log("Received message:", event.data);  // Log received data
                if (event.data === "[DONE]") {
                    eventSource.close();
                    _resolve();
                    return;
                }
                onMessage(event.data);
            };

            eventSource.onerror = (error) => {
                console.error("Streaming error, but ensuring final file is processed...");
                // xmlParser.end(); // Process last file before closing
            
                setTimeout(() => {
                    reject(error);
                    eventSource.close();
                }, 100); // Give time for `end()` to execute
            };

            return () => eventSource.close();
        });
    }

    return { startStreaming };

    function transformMessages(messages: { role: string, content: string }[]) {
        return messages;  // If messages are already structured properly, no need to transform
    }
}
