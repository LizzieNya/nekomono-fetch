
import KemonoFetcher from '@/components/kemono-fetcher';
import { Github } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center bg-background">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
      </div>
      <header className="sticky top-0 z-40 w-full border-b bg-background/60 backdrop-blur-xl">
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <h1 className="font-headline text-lg font-bold text-primary">Nekomono Fetch</h1>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <p className="text-sm text-muted-foreground hidden md:block">
              Maintained by{' '}
              <a href="https://github.com/lizzienya" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                LizzieNya
              </a>
              {' for '}
              <a href="https://g.dev/nekoclub" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                nekoclub.cloud
              </a>
              . This project is FOSS. View the source code on{' '}
              <a href="https://github.com/LizzieNya/nekomono-fetch" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="inline-flex items-center gap-1 font-medium text-primary transition-opacity hover:opacity-80">
                GitHub <Github className="h-4 w-4" />
              </a>.
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full">
        <div className="container flex flex-col items-center justify-start py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
            Nekomono Fetch
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed mt-4">
            A simple but powerful interface to query the{' '}
            <a href="https://kemono.su/documentation/api" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                kemono.su API
            </a>
            . Fetch posts by creator or by specific post ID.
          </p>
          <div className="mt-12 w-full max-w-4xl">
            <KemonoFetcher />
          </div>
        </div>
      </main>
      <footer className="w-full py-6 text-center text-sm text-muted-foreground">
        <div className="container border-t pt-6">
          <p className="text-xs">
              This unofficial tool is built upon the wonderful{' '}
              <a href="https://kemono.su/" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                Kemono.su
              </a>
              {' and its '}
              <a href="https://kemono.su/documentation/api" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                API
              </a>
              , created and maintained by NKHoncho. Our organization, nekoclub.cloud, other than sharing a feline theme with the latter, is in no way shape or form affiliated with Nekohouse.su, or NekoHQ, which are intellectual property of NKHoncho.
          </p>
        </div>
      </footer>
    </div>
  );
}
