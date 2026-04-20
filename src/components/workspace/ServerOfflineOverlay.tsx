import { useState, useEffect } from 'react';

import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
import { checkServerHealth } from '@/api/server';

export default function ServerOfflineOverlay() {
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [imageIndex, setImageIndex] = useState(1);

  useEffect(() => {
    setImageIndex(Math.random() > 0.5 ? 1 : 2);
  }, []);

  const startCommand = 'npm run start';

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          checkHealth();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkHealth = async () => {
    const isOnline = await checkServerHealth();
    if (isOnline) {
      window.location.reload();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(startCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">

      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl mx-auto py-12 px-4 flex flex-col md:flex-row items-center gap-12 min-h-full">
          
          {/* Left: Image */}
          <div className="flex-1 w-full max-w-xl mx-auto md:mx-0">
            <div className="rounded-2xl overflow-hidden border border-border shadow-2xl relative aspect-video bg-muted group">
              <img 
                src={`/assets/offline-${imageIndex}.png`} 
                alt="Server Offline" 
                className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 text-red-400 font-medium bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-lg w-fit border border-red-500/20">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Connection Refused
                </div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="flex-1 w-full space-y-8">
            <div className="space-y-4">
              <Logo size="lg" />
              <h1 className="text-4xl font-bold tracking-tight mt-4">Backend Offline</h1>
              <p className="text-lg text-muted-foreground">
                Your ProductOS frontend is ready, but we can't reach the local server. Since this is a privacy-first application, the backend must be running on your machine.
              </p>
            </div>

            <div className="space-y-4 bg-muted/50 p-6 rounded-xl border border-border">
              <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                <Terminal className="w-4 h-4" />
                Start the Server
              </h3>
              
              <div className="relative group">
                <pre className="p-4 rounded-lg bg-zinc-950 text-emerald-400 font-mono text-sm overflow-x-auto border border-zinc-800">
                  <code>{startCommand}</code>
                </pre>
                <Button 
                  size="sm" 
                  variant={copied ? "default" : "secondary"}
                  className="absolute right-2 top-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
                  onClick={handleCopy}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-[spin_4s_linear_infinite]" />
                Reconnecting in {timeRemaining}s...
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" onClick={checkHealth} className="w-full sm:w-auto px-8 font-semibold">
                Reconnect Now
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
