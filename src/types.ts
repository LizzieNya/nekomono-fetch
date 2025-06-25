
export type Favorite = {
  id: string;
  service: string;
  name: string;
  icon: string;
  updated: string;
};

export type PostFile = {
  name: string;
  path: string;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  published: string;
  file: PostFile;
  attachments: PostFile[];
};
