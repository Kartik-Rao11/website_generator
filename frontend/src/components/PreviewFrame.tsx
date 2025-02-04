import { WebContainer } from '@webcontainer/api';
import React, { useEffect, useState } from 'react';

interface PreviewFrameProps {
  files: any[];
  webContainer?: WebContainer | null;
}

export function PreviewFrame({ files, webContainer }: PreviewFrameProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function main() {
    if (!webContainer) {
      setError("WebContainer not initialized");
      return;
    }

    try {
      console.log('Starting npm install...');
      const installProcess = await webContainer.spawn('npm', ['install']);
      
      await installProcess.exit;
      console.log('npm install completed');

      // Check package.json scripts
      const packageJsonContent = await webContainer.fs.readFile('package.json', 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      console.log('Available scripts:', packageJson.scripts);

      // Try different potential dev scripts
      const devScripts = ['dev', 'start', 'serve'];
      let serverStarted = false;

      for (const script of devScripts) {
        if (packageJson.scripts[script]) {
          try {
            console.log(`Attempting to run: npm run ${script}`);
            const devProcess = await webContainer.spawn('npm', ['run', script]);
            
            // Capture output
            const outputWriter = new WritableStream({
              write(data) {
                console.log(`${script} server output:`, data);
              }
            });
            
            devProcess.output.pipeTo(outputWriter);

            // Wait for server-ready event
            webContainer.on('server-ready', (port, serverUrl) => {
              console.log(`Server ready on ${serverUrl}:${port}`);
              setUrl(serverUrl);
              serverStarted = true;
            });

            // Add a timeout to check if server starts
            await new Promise((resolve, reject) => {
              setTimeout(() => {
                if (!serverStarted) {
                  console.log(`Failed to start server with ${script} script`);
                  reject(new Error(`Server not started with ${script} script`));
                } else {
                  resolve(null);
                }
              }, 10000);
            });

            break;
          } catch (scriptError) {
            console.error(`Error running ${script} script:`, scriptError);
          }
        }
      }

      if (!serverStarted) {
        throw new Error('Could not start development server');
      }

    } catch (err) {
      console.error('Error in WebContainer setup:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  useEffect(() => {
    main();
  }, [webContainer]);

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-gray-400">
      {!url && <div className="text-center">
        <p className="mb-2">Loading WebContainer...</p>
      </div>}
      {url && (
        <iframe 
          width="100%" 
          height="100%" 
          src={url} 
          title="WebContainer Preview"
        />
      )}
    </div>
  );
}