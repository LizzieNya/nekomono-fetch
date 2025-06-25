
"use client";

import { useState, useEffect } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Trash2, PlusCircle, Download, RefreshCw, LogIn, LogOut, Info, Rss, Sticker, Users } from "lucide-react";
import { loginToKemono, validateSession, kemonoApiRequest } from "@/app/actions";
import { importFavoritesFromKemono, fetchAllFavoritesPosts } from "@/app/favoritesActions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import PostViewer from "./post-viewer";
import type { Favorite, Post } from "@/types";


const KEMONO_BASE_URL = "https://kemono.su";

// Zod schemas for form validation.
const creatorSchema = z.object({
  service: z.string().min(1),
  creatorId: z.string().min(1),
});

const postSchema = z.object({
  service: z.string().min(1),
  creatorId: z.string().min(1),
  postId: z.string().min(1),
});

const favoriteSchema = z.object({
  service: z.string().min(1),
  creatorId: z.string().min(1),
});

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

const sessionSchema = z.object({
    sessionCookie: z.string().min(1).refine(
        (val) => val.trim().startsWith("session="),
    ),
});

const discordLookupSchema = z.object({
  type: z.enum(["channel", "server", "member"]),
  query: z.string().min(1),
});


// Form value types.
type CreatorFormValues = z.infer<typeof creatorSchema>;
type PostFormValues = z.infer<typeof postSchema>;
type FavoriteFormValues = z.infer<typeof favoriteSchema>;
type LoginFormValues = z.infer<typeof loginSchema>;
type SessionFormValues = z.infer<typeof sessionSchema>;
type DiscordLookupFormValues = z.infer<typeof discordLookupSchema>;

type LoggedInUser = {
  username: string;
  cookie: string;
}

// List of supported services.
const allServices = [
  { value: "patreon", label: "Patreon" },
  { value: "fanbox", label: "Fanbox" },
  { value: "fantia", label: "Fantia" },
  { value: "subscribestar", label: "SubscribeStar" },
  { value: "dlsite", label: "DLsite" },
  { value: "gumroad", label: "Gumroad" },
  { value: "discord", label: "Discord (Server)" },
  { value: "onlyfans", label: "OnlyFans" },
];

const favoritableServices = allServices.filter(s => s.value !== 'discord');

/**
 * Service selection dropdown.
 */
const ServiceSelectField = ({ control, onValueChange, services: servicesProp }: { control: any; onValueChange?: (value: string) => void, services: typeof allServices }) => (
  <FormField
    control={control}
    name="service"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Service</FormLabel>
        <Select onValueChange={(value) => {
          field.onChange(value);
          onValueChange?.(value);
        }} defaultValue={field.value}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select a service" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {servicesProp.map((service) => (
              <SelectItem key={service.value} value={service.value}>
                {service.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
);

export default function KemonoFetcher() {
  const { toast } = useToast();
  
  // Component State
  const [activeTab, setActiveTab] = useState("creator");
  const [data, setData] = useState<any | null>(null); // API response data
  const [isLoading, setIsLoading] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [creatorPosts, setCreatorPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [responseContext, setResponseContext] = useState<string | null>(null);
  const [allFavoritesFeed, setAllFavoritesFeed] = useState<Post[]>([]);
  const [visibleFeedCount, setVisibleFeedCount] = useState(50);

  // Sorted list of favorites by most recent update.
  const sortedFavorites = [...favorites].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

  /**
   * Load user session and favorites from localStorage on mount.
   */
  useEffect(() => {
    try {
      const userItem = window.localStorage.getItem('kemonoUser');
      if (userItem) {
          setLoggedInUser(JSON.parse(userItem));
      }
      const favoritesItem = window.localStorage.getItem('kemonoFavorites');
      if (favoritesItem) {
        const loadedFavorites = JSON.parse(favoritesItem);
        // Backwards compatibility: Ensure old favorites have a default 'updated' field.
        const sanitizedFavorites = loadedFavorites.map((fav: any) => ({
            ...fav,
            updated: fav.updated || new Date(0).toISOString(),
        }));
        setFavorites(sanitizedFavorites);
      }
    } catch (error) {
      console.warn(`Error reading localStorage:`, error);
    } finally {
      setIsInitialLoad(false);
    }
  }, []);

  /**
   * Save user session and favorites to localStorage on change.
   */
  useEffect(() => {
    if (!isInitialLoad) {
      if (loggedInUser) {
        window.localStorage.setItem('kemonoUser', JSON.stringify(loggedInUser));
      } else {
        window.localStorage.removeItem('kemonoUser');
      }
      window.localStorage.setItem('kemonoFavorites', JSON.stringify(favorites));
    }
  }, [loggedInUser, favorites, isInitialLoad]);

  // Form hooks
  const creatorForm = useForm<CreatorFormValues>({ resolver: zodResolver(creatorSchema), defaultValues: { service: "", creatorId: "" }});
  const postForm = useForm<PostFormValues>({ resolver: zodResolver(postSchema), defaultValues: { service: "", creatorId: "", postId: "" }});
  const favoriteForm = useForm<FavoriteFormValues>({ resolver: zodResolver(favoriteSchema), defaultValues: { service: "", creatorId: "" }});
  const forceUpdateForm = useForm<CreatorFormValues>({ resolver: zodResolver(creatorSchema), defaultValues: { service: "", creatorId: "" }});
  const loginForm = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: "", password: "" } });
  const sessionForm = useForm<SessionFormValues>({ resolver: zodResolver(sessionSchema), defaultValues: { sessionCookie: "" } });
  const discordLookupForm = useForm<DiscordLookupFormValues>({ resolver: zodResolver(discordLookupSchema), defaultValues: { type: "channel", query: "" }});


  // Watch form fields for changes
  const watchedServiceCreator = creatorForm.watch('service');
  const watchedServicePost = postForm.watch('service');
  const watchedCreatorForPosts = postForm.watch('creatorId');
  const watchedServiceForceUpdate = forceUpdateForm.watch('service');

  // Filter favorites based on selected service
  const filteredFavoritesCreator = favorites.filter(fav => fav.service === watchedServiceCreator);
  const filteredFavoritesPost = favorites.filter(fav => fav.service === watchedServicePost);
  const filteredFavoritesForceUpdate = favorites.filter(fav => fav.service === watchedServiceForceUpdate);

  /**
   * Generic handler for API requests that sets loading state and displays toasts.
   */
  const handleApiRequest = async (apiRequest: Promise<{ success: boolean; data?: any; error?: string }>, context: string) => {
    setResponseContext(context);
    setIsLoading(true);
    setData(null);

    const result = await apiRequest;

    if (result.success) {
      const responseData = result.data;
      if ((Array.isArray(responseData) && responseData.length === 0) || (typeof responseData === 'object' && responseData !== null && Object.keys(responseData).length === 0)) {
        toast({title: "No Results", description: "The API returned no data for your query."});
        setData(null);
      } else {
        setData(responseData);
      }
    } else {
      toast({
        variant: "destructive",
        title: "API Request Failed",
        description: result.error,
      });
    }

    setIsLoading(false);
  };


  /**
   * Fetch all posts for a creator to populate the post dropdown.
   */
  useEffect(() => {
    const fetchPosts = async () => {
      if (watchedCreatorForPosts && watchedServicePost) {
        setPostsLoading(true);
        setCreatorPosts([]);
        postForm.resetField('postId', { defaultValue: '' });
        
        const path = watchedServicePost === 'discord' ? `/discord/server/${watchedCreatorForPosts}` : `/${watchedServicePost}/user/${watchedCreatorForPosts}`;
        const result = await kemonoApiRequest(path);

        if (result.success && Array.isArray(result.data)) {
            const sortedPosts = result.data.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
            setCreatorPosts(sortedPosts);
        } else {
            toast({ variant: "destructive", title: "Could not fetch posts", description: result.success ? "Unexpected data format." : result.error });
        }

        setPostsLoading(false);
      }
    };
    fetchPosts();
  }, [watchedCreatorForPosts, watchedServicePost, postForm, toast]);
  
  /**
   * Adds a creator to local favorites, fetching their details first.
   */
  const handleAddFavorite: SubmitHandler<FavoriteFormValues> = async ({ service, creatorId }) => {
    setIsLoading(true);
    if (favorites.some(f => f.id === creatorId && f.service === service)) {
      toast({ title: "Already a favorite!", description: "This creator is already in your favorites list." });
      setIsLoading(false);
      return;
    }

    const path = service === 'discord' ? `/${service}/server/${creatorId}` : `/${service}/user/${creatorId}`;
    const result = await kemonoApiRequest(path);

    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      const posts = result.data;
      posts.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
      const user = posts[0].user;
      const newFavorite: Favorite = { 
        id: user.id, 
        service: service, 
        name: user.name, 
        icon: user.icon,
        updated: posts[0].published,
      };
      setFavorites(prev => [...prev, newFavorite]);
      toast({ title: "Favorite Added", description: `${user.name} has been added to your favorites.` });
      favoriteForm.reset();
    } else {
       toast({ variant: "destructive", title: "Failed to Add Favorite", description: result.success ? "Creator not found or has no posts." : result.error });
    }
    
    setIsLoading(false);
  };

  /**
   * Imports followed artists from a logged-in Kemono account by calling a Server Action.
   */
  const handleImportFavorites = async () => {
    if (!loggedInUser) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to import favorites." });
        return;
    }
    setResponseContext("account");
    setIsLoading(true);
    setData(null);

    const result = await importFavoritesFromKemono(loggedInUser.cookie, favorites);
    
    if (result.success) {
        if (result.newFavorites.length > 0) {
            setFavorites(prev => [...prev, ...result.newFavorites]);
        }
        toast({ title: "Import Complete", description: result.message });
    } else {
        toast({ variant: "destructive", title: "Import Failed", description: result.error });
    }
    setIsLoading(false);
  };

  const handleFetchAllFavorites = async () => {
    if (favorites.length === 0) {
        toast({ title: "No Favorites", description: "You don't have any favorites to fetch posts from." });
        return;
    }
    setResponseContext("favorites");
    setIsLoading(true);
    setData(null);
    setAllFavoritesFeed([]);
    setVisibleFeedCount(50);
    
    const result = await fetchAllFavoritesPosts(favorites);

    if (result.success) {
        setAllFavoritesFeed(result.data);
        setData(result.data.slice(0, 50));
        if (result.data.length === 0) {
            toast({title: "No Results", description: "The API returned no data for your query."});
            setData(null);
        }
    } else {
        toast({
            variant: "destructive",
            title: "API Request Failed",
            description: result.error,
        });
    }
    setIsLoading(false);
  };
  
  const handleLoadMoreFavorites = () => {
    const newVisibleCount = visibleFeedCount + 50;
    setVisibleFeedCount(newVisibleCount);
    setData(allFavoritesFeed.slice(0, newVisibleCount));
  };


  /**
   * Removes a creator from the local favorites list.
   */
  const handleRemoveFavorite = (id: string, service: string) => {
    setFavorites(prev => prev.filter(fav => !(fav.id === id && fav.service === service)));
    toast({ title: "Favorite Removed" });
  };
  
  /**
   * Adds all creators from a `creator_links` API response to favorites.
   */
  const handleAddAll = () => {
    if (!data || !Array.isArray(data)) return;
    const newFavorites = data
      .map(creator => ({
          id: creator.id,
          service: creator.service,
          name: creator.name || 'Unknown Name',
          icon: creator.icon || '',
          updated: creator.updated || new Date(0).toISOString(),
      }))
      .filter((newFav: Favorite) => !favorites.some(oldFav => oldFav.id === newFav.id && oldFav.service === newFav.service));
    
    if (newFavorites.length > 0) {
        setFavorites(prev => [...prev, ...newFavorites]);
        toast({ title: "Favorites Updated", description: `${newFavorites.length} new creators added.` });
    } else {
        toast({ title: "No New Creators", description: "All displayed creators are already in your favorites." });
    }
  };

  /**
   * Handles automated login.
   */
  const onLoginSubmit: SubmitHandler<LoginFormValues> = async (values) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('username', values.username);
    formData.append('password', values.password);

    const result = await loginToKemono(formData);
    if (result.success) {
        setLoggedInUser({ username: result.username, cookie: result.cookie });
        toast({ title: "Login Successful", description: `Welcome, ${result.username}!` });
        loginForm.reset();
    } else {
        toast({ variant: "destructive", title: "Login Failed", description: result.error });
    }
    setIsLoading(false);
  };
  
  /**
   * Handles manual session cookie login.
   */
  const onSessionSubmit: SubmitHandler<SessionFormValues> = async (values) => {
    setIsLoading(true);
    const result = await validateSession(values.sessionCookie);
  
    if (result.success) {
      setLoggedInUser({ username: result.username, cookie: values.sessionCookie });
      toast({ title: "Login Successful", description: `Welcome, ${result.username}! Your session is now active.` });
      sessionForm.reset();
    } else {
      toast({ variant: "destructive", title: "Login Failed", description: result.error });
    }
    setIsLoading(false);
  };

  /**
   * Logs the user out.
   */
  const handleLogout = () => {
    setLoggedInUser(null);
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  /**
   * Handles "By Creator" form submission.
   */
  const onCreatorSubmit: SubmitHandler<CreatorFormValues> = (values) => {
    const path = values.service === 'discord' ? `/${values.service}/server/${values.creatorId}` : `/${values.service}/user/${values.creatorId}`;
    handleApiRequest(kemonoApiRequest(path), "creator");
  };

  /**
   * Handles "By Post" form submission.
   */
  const onPostSubmit: SubmitHandler<PostFormValues> = (values) => {
    const path = values.service === 'discord' ? `/${values.service}/server/${values.creatorId}/post/${values.postId}` : `/${values.service}/user/${values.creatorId}/post/${values.postId}`;
    handleApiRequest(kemonoApiRequest(path), "post");
  };
  
  /**
   * Handles "Request Creator Update" form submission.
   */
  const onForceUpdateSubmit: SubmitHandler<CreatorFormValues> = async (values) => {
    if (!loggedInUser) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to request an update." });
        return;
    }
    setResponseContext("account");
    setIsLoading(true);
    setData(null);

    const result = await kemonoApiRequest('/importer/submit', {
      method: 'POST',
      body: { service: values.service, id: values.creatorId },
      cookie: loggedInUser.cookie,
    });

    if (result.success) {
      toast({ title: "Update Queued", description: `An update for creator ${values.creatorId} has been successfully requested.` });
      forceUpdateForm.reset();
    } else {
       toast({ variant: "destructive", title: "Update Request Failed", description: result.error });
    }

    setIsLoading(false);
  };

  /**
   * Handles "Discord Lookup" form submission.
   */
  const onDiscordLookupSubmit: SubmitHandler<DiscordLookupFormValues> = (values) => {
    const path = `/discord/${values.type}/lookup?q=${encodeURIComponent(values.query)}`;
    handleApiRequest(kemonoApiRequest(path), "account");
  };

  /**
   * Renders the content of the API response card.
   */
  const renderResponse = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="mt-4 text-muted-foreground">Fetching data...</p>
        </div>
      );
    }
    
    if (data) {
      // Check if data is a single post or a list of posts
      const isPostData = 
        (data && !Array.isArray(data) && data.hasOwnProperty('id') && data.hasOwnProperty('title')) ||
        (Array.isArray(data) && data.length > 0 && data[0].hasOwnProperty('id') && data[0].hasOwnProperty('title'));

      if (isPostData) {
        return (
            <>
                <PostViewer data={data} />
                {responseContext === 'favorites' && visibleFeedCount < allFavoritesFeed.length && (
                    <Button onClick={handleLoadMoreFavorites} className="mt-4 w-full">
                        Load More Posts
                    </Button>
                )}
            </>
        );
      }
      
      // Fallback to JSON view for other data types
      return (
        <div>
          <pre className="w-full rounded-md bg-muted p-4 text-sm overflow-auto max-h-[60vh]">
            <code className="font-code text-foreground">{JSON.stringify(data, null, 2)}</code>
          </pre>
          {Array.isArray(data) && data.length > 0 && data[0].hasOwnProperty('service') && data[0].hasOwnProperty('id') && (
            <Button onClick={handleAddAll} className="mt-4 w-full bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4 text-primary-foreground" />
              Add All Displayed Creators to Favorites
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>Your API response will be displayed here.</p>
      </div>
    );
  };

  const ApiResponseDisplay = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">API Response</CardTitle>
        <CardDescription>Results from the Kemono API will appear below.</CardDescription>
      </CardHeader>
      <CardContent>{renderResponse()}</CardContent>
    </Card>
  );

  return (
    <>
      <div className="w-full space-y-8">
        <Tabs 
            value={activeTab} 
            onValueChange={(tab) => {
                setActiveTab(tab);
                setData(null);
                setResponseContext(null);
                setAllFavoritesFeed([]);
                setVisibleFeedCount(50);
            }} 
            className="w-full"
        >
          {/* Desktop: single row of 4 tabs */}
          <div className="hidden md:block">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="creator">By Creator</TabsTrigger>
              <TabsTrigger value="post">By Post</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
          </div>
          {/* Mobile: two rows of 2 tabs */}
          <div className="flex flex-col gap-2 md:hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="creator">By Creator</TabsTrigger>
              <TabsTrigger value="post">By Post</TabsTrigger>
            </TabsList>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="creator" className="mt-4 md:mt-6">
            {responseContext === 'creator' && <ApiResponseDisplay />}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="font-headline">Creator Lookup</CardTitle>
                <CardDescription>Fetch all posts from a specific creator or Discord server.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...creatorForm}>
                  <form onSubmit={creatorForm.handleSubmit(onCreatorSubmit)} className="space-y-6">
                    <ServiceSelectField control={creatorForm.control} services={allServices} onValueChange={() => creatorForm.resetField('creatorId', { defaultValue: '' })} />
                    <FormField
                      control={creatorForm.control}
                      name="creatorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Creator / Server ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel className="sr-only">Select a Favorite</FormLabel>
                       <Select onValueChange={(value) => { if (value && value !== 'disabled') creatorForm.setValue('creatorId', value, { shouldValidate: true })}} disabled={!watchedServiceCreator}>
                        <FormControl>
                          <SelectTrigger>
                             <SelectValue placeholder={!watchedServiceCreator ? "Select a service first" : "Or select a favorite..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {filteredFavoritesCreator.length > 0 ? (
                              filteredFavoritesCreator.map((fav) => (
                                <SelectItem key={fav.id} value={fav.id}>
                                  {fav.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="disabled" disabled>
                                No favorites for this service.
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </FormItem>
                    <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4 text-primary-foreground" />}
                      Fetch Posts
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="post" className="mt-4 md:mt-6">
            {responseContext === 'post' && <ApiResponseDisplay />}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="font-headline">Post Lookup</CardTitle>
                <CardDescription>Fetch a single post by its ID.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...postForm}>
                  <form onSubmit={postForm.handleSubmit(onPostSubmit)} className="space-y-6">
                    <ServiceSelectField control={postForm.control} services={allServices} onValueChange={() => {
                       postForm.resetField('creatorId', { defaultValue: '' });
                       postForm.resetField('postId', { defaultValue: '' });
                       setCreatorPosts([]);
                    }}/>
                    <FormField
                      control={postForm.control}
                      name="creatorId"
                      render={({ field }) => (
                         <FormItem>
                          <FormLabel>Creator / Server ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter ID" {...field} onChange={(e) => {
                                field.onChange(e);
                                if (creatorPosts.length > 0) setCreatorPosts([]);
                                postForm.resetField('postId', { defaultValue: '' });
                            }}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormItem>
                      <FormLabel className="sr-only">Select a Favorite</FormLabel>
                       <Select onValueChange={(value) => { if (value && value !== 'disabled') postForm.setValue('creatorId', value, { shouldValidate: true })}} disabled={!watchedServicePost}>
                        <FormControl>
                          <SelectTrigger>
                             <SelectValue placeholder={!watchedServicePost ? "Select a service first" : "Or select a favorite..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {filteredFavoritesPost.length > 0 ? (
                              filteredFavoritesPost.map((fav) => (
                                <SelectItem key={fav.id} value={fav.id}>
                                  {fav.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="disabled" disabled>
                                No favorites for this service.
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </FormItem>
                    <FormField
                      control={postForm.control}
                      name="postId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Post</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!watchedCreatorForPosts || postsLoading || creatorPosts.length === 0}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={
                                  postsLoading ? "Loading posts..." : 
                                  !watchedCreatorForPosts ? "Enter/select a creator first" : 
                                  "Select a post (newest first)"
                                } />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {creatorPosts.length > 0 ? (
                                 creatorPosts.map((post) => (
                                  <SelectItem key={post.id} value={post.id}>
                                    {post.title}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="disabled" disabled>
                                  {postsLoading ? "Loading..." : "No posts found."}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4 text-primary-foreground" />}
                      Fetch Post
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="favorites" className="mt-4 md:mt-6">
            {responseContext === 'favorites' && <ApiResponseDisplay />}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 overflow-hidden">
                <CardHeader>
                  <CardTitle className="font-headline">Add a Favorite</CardTitle>
                  <CardDescription>Add a new creator to your favorites list by ID.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...favoriteForm}>
                    <form onSubmit={favoriteForm.handleSubmit(handleAddFavorite)} className="space-y-6">
                      <ServiceSelectField control={favoriteForm.control} services={favoritableServices} />
                      <FormField
                        control={favoriteForm.control}
                        name="creatorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Creator ID</FormLabel>
                            <FormControl>
                              <Input placeholder="The ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4 text-primary-foreground" />}
                        Add Favorite
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2 overflow-hidden">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <CardTitle className="font-headline">Your Favorites</CardTitle>
                      <CardDescription>Your saved creators. Click a creator to view their posts, or fetch from all.</CardDescription>
                    </div>
                    <Button 
                      onClick={handleFetchAllFavorites} 
                      disabled={isLoading || favorites.length === 0} 
                      className="w-full sm:w-auto flex-shrink-0"
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rss className="mr-2 h-4 w-4" />}
                      Fetch All Posts
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {favorites.length === 0 ? (
                    <p className="text-muted-foreground text-center">You have no favorites yet. Add one above or import them from the Account tab.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {sortedFavorites.map((fav) => (
                        <Card key={`${fav.service}-${fav.id}`} className="flex flex-col hover:border-primary transition-colors">
                          <CardHeader className="flex flex-row items-center gap-4">
                            <Avatar>
                              <AvatarImage src={`${KEMONO_BASE_URL}${fav.icon}`} alt={fav.name} />
                              <AvatarFallback>{fav.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                              <CardTitle className="text-lg truncate">{fav.name}</CardTitle>
                              <CardDescription>{allServices.find(s => s.value === fav.service)?.label}</CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent className="mt-auto pt-4">
                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                        const path = fav.service === 'discord' ? `/discord/server/${fav.id}` : `/${fav.service}/user/${fav.id}`;
                                        handleApiRequest(kemonoApiRequest(path), "favorites");
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    View Posts
                                </Button>
                                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleRemoveFavorite(fav.id, fav.service)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                                </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="account" className="mt-4 md:mt-6">
              {responseContext === 'account' && <ApiResponseDisplay />}
              <Card className="overflow-hidden">
                   <CardHeader>
                      <CardTitle className="font-headline">Account &amp; API Actions</CardTitle>
                      <CardDescription>
                          Log in to use authenticated features, or use general purpose API actions.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      {!loggedInUser ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <Card>
                                  <CardHeader>
                                      <CardTitle className="text-lg">Automated Login</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                      <Alert variant="default" className="mb-4">
                                          <Info className="h-4 w-4" />
                                          <AlertTitle>Note on Automated Login</AlertTitle>
                                          <AlertDescription>
                                              This method may be blocked by Kemono's anti-bot protection. If it fails, please use the manual session cookie method below for a more reliable login.
                                          </AlertDescription>
                                      </Alert>
                                      <Form {...loginForm}>
                                          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                                              <FormField
                                                  control={loginForm.control}
                                                  name="username"
                                                  render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel>Username</FormLabel>
                                                          <FormControl>
                                                              <Input placeholder="Your username" {...field} />
                                                          </FormControl>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}
                                              />
                                              <FormField
                                                  control={loginForm.control}
                                                  name="password"
                                                  render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel>Password</FormLabel>
                                                          <FormControl>
                                                              <Input type="password" placeholder="Your password" {...field} />
                                                          </FormControl>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}
                                              />
                                              <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90">
                                                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                                  Login
                                              </Button>
                                          </form>
                                      </Form>
                                  </CardContent>
                              </Card>
                              <Card>
                                  <CardHeader>
                                      <CardTitle className="text-lg">Manual Login (Recommended)</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                      <Form {...sessionForm}>
                                          <form onSubmit={sessionForm.handleSubmit(onSessionSubmit)} className="space-y-4">
                                              <FormField
                                                  control={sessionForm.control}
                                                  name="sessionCookie"
                                                  render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel>Kemono Session Cookie</FormLabel>
                                                          <FormControl>
                                                              <Input placeholder="session=..." {...field} />
                                                          </FormControl>
                                                          <FormDescription>
                                                              Login to Kemono in your browser, open developer tools (F12), go to Application → Cookies, and copy the full value of the 'session' cookie.
                                                          </FormDescription>
                                                          <FormMessage />
                                                      </FormItem>
                                                  )}
                                              />
                                              <Button type="submit" disabled={isLoading} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                                                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                                  Set Session
                                              </Button>
                                          </form>
                                      </Form>
                                  </CardContent>
                              </Card>
                          </div>
                      ) : (
                          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                               <p className="font-medium">Logged in as <span className="font-bold text-primary">{loggedInUser.username}</span>.</p>
                              <Button variant="outline" onClick={handleLogout}>
                                  <LogOut className="mr-2 h-4 w-4"/>
                                  Logout
                              </Button>
                          </div>
                      )}
                      <Separator />
                      <div className="space-y-2">
                        <h3 className="text-xl font-headline">Normal Use</h3>
                        <p className="text-sm text-muted-foreground">Commonly used actions for everyday use.</p>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg font-headline">Import Favorites</CardTitle>
                                <CardDescription>Import your followed artists from your Kemono account.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={handleImportFavorites} disabled={isLoading || !loggedInUser} className="w-full bg-primary hover:bg-primary/90">
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4 text-primary-foreground" />}
                                    Import from Account
                                </Button>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg font-headline">Recent Posts</CardTitle>
                                <CardDescription>Fetch the 50 most recently published posts.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={() => handleApiRequest(kemonoApiRequest('/posts'), "account")}
                                    disabled={isLoading}
                                    className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rss className="mr-2 h-4 w-4" />}
                                    Fetch Recent Posts
                                </Button>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg font-headline">Announcements</CardTitle>
                                <CardDescription>Fetch the latest site-wide announcements.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={() => handleApiRequest(kemonoApiRequest('/info/announcements'), "account")}
                                    disabled={isLoading}
                                    className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Info className="mr-2 h-4 w-4" />}
                                    Fetch Announcements
                                </Button>
                            </CardContent>
                        </Card>
                      </div>

                      <Separator />
                      <div className="space-y-2">
                        <h3 className="text-xl font-headline">Advanced Use</h3>
                        <p className="text-sm text-muted-foreground">Less common or more specific API actions.</p>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                           <CardHeader>
                                <CardTitle className="text-lg font-headline">Discord Lookup</CardTitle>
                                <CardDescription>Find a Discord channel, server, or member.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...discordLookupForm}>
                                    <form onSubmit={discordLookupForm.handleSubmit(onDiscordLookupSubmit)} className="space-y-4">
                                        <FormField
                                            control={discordLookupForm.control}
                                            name="type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Lookup Type</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select a type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="channel">Channel</SelectItem>
                                                            <SelectItem value="server">Server</SelectItem>
                                                            <SelectItem value="member">Member</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={discordLookupForm.control}
                                            name="query"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Name or ID</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Enter search query" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" disabled={isLoading} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                            Lookup Discord
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg font-headline">Creator Links</CardTitle>
                                    <CardDescription>Fetch moderator tasks for creator links (requires login).</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <Button
                                    onClick={() => handleApiRequest(kemonoApiRequest('/account/moderator/tasks/creator_links', { cookie: loggedInUser?.cookie }), "account")}
                                    disabled={isLoading || !loggedInUser}
                                    className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                                    Fetch Creator Links
                                </Button>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg font-headline">Sticker Packs</CardTitle>
                                    <CardDescription>Fetch your saved sticker packs (requires login).</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <Button
                                    onClick={() => handleApiRequest(kemonoApiRequest('/account/favorites?type=sticker', { cookie: loggedInUser?.cookie }), "account")}
                                    disabled={isLoading || !loggedInUser}
                                    className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sticker className="mr-2 h-4 w-4" />}
                                    Fetch Sticker Packs
                                </Button>
                                </CardContent>
                            </Card>
                        </div>
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-lg font-headline">Request Creator Update</CardTitle>
                                <CardDescription>
                                    Request an immediate import of a creator's profile and posts (requires login).
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                            <Form {...forceUpdateForm}>
                                <form onSubmit={forceUpdateForm.handleSubmit(onForceUpdateSubmit)} className="space-y-6">
                                <ServiceSelectField control={forceUpdateForm.control} services={allServices} onValueChange={() => forceUpdateForm.resetField('creatorId', { defaultValue: '' })} />
                                <FormField
                                    control={forceUpdateForm.control}
                                    name="creatorId"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Creator / Server ID</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Enter ID" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormItem>
                                    <FormLabel className="sr-only">Select a Favorite</FormLabel>
                                    <Select onValueChange={(value) => { if (value && value !== 'disabled') forceUpdateForm.setValue('creatorId', value, { shouldValidate: true })}} disabled={!watchedServiceForceUpdate}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder={!watchedServiceForceUpdate ? "Select a service first" : "Or select a favorite..."} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {filteredFavoritesForceUpdate.length > 0 ? (
                                            filteredFavoritesForceUpdate.map((fav) => (
                                              <SelectItem key={fav.id} value={fav.id}>
                                                {fav.name}
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <SelectItem value="disabled" disabled>
                                              No favorites for this service.
                                            </SelectItem>
                                          )}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                <Button type="submit" disabled={isLoading || !loggedInUser} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Request Update
                                </Button>
                                </form>
                            </Form>
                            </CardContent>
                        </Card>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
