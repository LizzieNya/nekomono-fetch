
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Paperclip, FileText, Download } from "lucide-react";
import { format } from 'date-fns';
import type { Post, PostFile } from "@/types";

const KEMONO_BASE_URL = "https://kemono.su";

function renderMedia(file: PostFile) {
  const url = `${KEMONO_BASE_URL}${file.path}`;
  const fileName = (file.name || file.path).toLowerCase();

  if (/\.(jpg|jpeg|png|gif|webp)$/.test(fileName)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img 
          src={url} 
          alt={file.name} 
          className="rounded-md object-cover w-full h-auto max-h-[70vh] border" 
          loading="lazy"
        />
      </a>
    );
  }
  
  if (/\.(mp4|webm|mov)$/.test(fileName)) {
    return <video controls src={url} className="rounded-md w-full border" />;
  }

  // Default download button
  return (
    <Button asChild variant="outline" size="sm" className="w-full">
        <a href={url} target="_blank" rel="noopener noreferrer" download={file.name}>
            <Download className="mr-2 h-4 w-4" /> {file.name || 'Download'}
        </a>
    </Button>
  );
}


function PostCard({ post }: { post: Post }) {
  const publishedDate = post.published ? format(new Date(post.published), 'PPP') : 'No date';

  return (
    <Card className="w-full mb-6 break-inside-avoid">
      <CardHeader>
        <CardTitle>{post.title}</CardTitle>
        <CardDescription>Published on {publishedDate}</CardDescription>
      </CardHeader>
      <CardContent>
        {post.content && (
          <>
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
            <Separator className="my-4" />
          </>
        )}
        <div className="space-y-4">
          {post.file && post.file.path && (
             <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center"><FileText className="mr-2 h-4 w-4"/> Main File</h4>
                {renderMedia(post.file)}
            </div>
          )}
          {post.attachments && post.attachments.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center"><Paperclip className="mr-2 h-4 w-4"/> Attachments</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {post.attachments.map((attachment, index) => (
                  <div key={index} className="space-y-2">
                    {renderMedia(attachment)}
                    <p className="text-xs text-muted-foreground truncate" title={attachment.name}>{attachment.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PostViewer({ data }: { data: any }) {
  if (!data) return null;

  const posts: Post[] = Array.isArray(data) ? data : [data];

  return (
    <div className="w-full text-left">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
