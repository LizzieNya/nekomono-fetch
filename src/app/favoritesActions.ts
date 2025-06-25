
'use server';

import type { Favorite, Post } from '@/types';
import { kemonoApiRequest } from './actions';

export async function importFavoritesFromKemono(
    sessionCookie: string,
    currentFavorites: Favorite[]
): Promise<{ success: true; newFavorites: Favorite[]; message: string } | { success: false; error: string }> {
    if (!sessionCookie) {
        return { success: false, error: "You must be logged in to import favorites." };
    }
    
    const response = await kemonoApiRequest('/account/favorites?type=artist', { cookie: sessionCookie });

    if (!response.success) {
        return { success: false, error: `Import failed: ${response.error}` };
    }
    
    const responseData = response.data;

    if (!Array.isArray(responseData)) {
        return { success: false, error: "Favorites data from API is not in the expected format." };
    }
    
    if (responseData.length === 0) {
        return { success: true, newFavorites: [], message: "Your Kemono favorites list appears to be empty." };
    }

    const newFavorites: Favorite[] = responseData
        .filter((creator): creator is {id: string, service: string, name: string, icon: string, updated: string} => creator && creator.id && creator.service && creator.name && creator.updated)
        .map(creator => ({
            id: creator.id,
            service: creator.service,
            name: creator.name,
            icon: creator.icon || '',
            updated: creator.updated
        }))
        .filter((newFav: Favorite) => !currentFavorites.some(oldFav => oldFav.id === newFav.id && oldFav.service === newFav.service));
    
    if (newFavorites.length > 0) {
        return { success: true, newFavorites: newFavorites, message: `${newFavorites.length} new creators have been imported and added to your list.` };
    } else {
        return { success: true, newFavorites: [], message: "Your local list is already up-to-date with your Kemono account." };
    }
}

export async function fetchAllFavoritesPosts(
  favorites: Favorite[]
): Promise<{ success: true; data: Post[] } | { success: false; error: string }> {
  if (favorites.length === 0) {
    return { success: true, data: [] };
  }

  try {
    const postPromises = favorites.map(fav => {
      const path = fav.service === 'discord' ? `/discord/server/${fav.id}` : `/${fav.service}/user/${fav.id}`;
      return kemonoApiRequest(path);
    });

    const results = await Promise.all(postPromises);
    
    const allPosts: Post[] = [];
    for (const result of results) {
      if (result.success && Array.isArray(result.data)) {
        allPosts.push(...result.data);
      } else if (!result.success) {
        // Log or handle individual failures if necessary. For now, we just skip them.
        console.warn(`Failed to fetch posts for one favorite: ${result.error}`);
      }
    }

    if (allPosts.length === 0) {
        return { success: false, error: "Could not fetch posts from any of your favorite creators." };
    }

    allPosts.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

    return { success: true, data: allPosts };
  } catch (e: any) {
    console.error("Failed to fetch all favorites' posts:", e);
    return { success: false, error: "An unexpected error occurred while fetching posts for all favorites." };
  }
}
