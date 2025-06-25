'use server';

const KEMONO_API_BASE_URL = "https://kemono.su/api/v1";
// Standard browser User-Agent to avoid simple bot detection.
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

/**
 * A generic server action to make requests to the Kemono API.
 * This centralizes fetch logic, header management, and error handling.
 * @param path The API endpoint path (e.g., '/posts').
 * @param options Method, body, and session cookie for the request.
 * @returns A result object with either data or an error.
 */
export async function kemonoApiRequest(
    path: string, 
    options: { method?: 'GET' | 'POST', body?: any, cookie?: string } = {}
): Promise<{ success: true, data: any } | { success: false, error: string }> {
    try {
        const fetchOptions: RequestInit = {
            method: options.method || 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': BROWSER_USER_AGENT,
            },
            cache: 'no-store'
        };

        if (options.cookie) {
            (fetchOptions.headers as any)['Cookie'] = options.cookie;
        }

        if (options.body) {
            (fetchOptions.headers as any)['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(`${KEMONO_API_BASE_URL}${path}`, fetchOptions);

        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.json();
            } catch (parseError) {
                errorBody = { error: response.statusText || `Request failed with status ${response.status}` };
            }
            const errorMessage = errorBody?.error || `An unknown API error occurred. Status: ${response.status}`;
            return { success: false, error: errorMessage };
        }

        if (response.status === 204) {
            return { success: true, data: { message: "Request successful." } };
        }

        const result = await response.json();
        return { success: true, data: result };

    } catch (e: any) {
        console.error(`Kemono API request to path '${path}' failed:`, e);
        if (e.message?.toLowerCase().includes('failed to fetch')) {
             return { success: false, error: "Could not connect to the API. Please check your internet connection or try again later." };
        }
        return { success: false, error: "An unknown server error occurred during the API request." };
    }
}


/**
 * Login to Kemono with username and password.
 * This is a special case and does not use the generic request function because it needs to access response headers.
 * @param credentials FormData with 'username' and 'password'.
 * @returns Session cookie and username on success.
 */
export async function loginToKemono(credentials: FormData): Promise<{ success: true; cookie: string; username: string } | { success: false; error: string }> {
  const loginUrl = `${KEMONO_API_BASE_URL}/authentication/login`;
  const username = credentials.get('username') as string;
  const password = credentials.get('password') as string;

  if (!username || !password) {
      return { success: false, error: "Username and password are required." };
  }

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': BROWSER_USER_AGENT,
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            return { success: false, error: 'Login failed: Invalid username or password.' };
        }

        let errorBody;
        try {
            errorBody = await response.json();
        } catch (e) {
            errorBody = { error: `Server responded with status ${response.status}` };
        }
        const errorMessage = errorBody?.error || `An unknown error occurred. Status: ${response.status}`;
        return { success: false, error: `Login failed. ${errorMessage}` };
    }

    const cookies = response.headers.getSetCookie();
    if (!cookies || cookies.length === 0) {
      return { success: false, error: "Login seemed to succeed, but no session cookie was returned by the server." };
    }

    const sessionCookie = cookies.find(c => c.trim().startsWith('session='));
    if (!sessionCookie) {
      return { success: false, error: "Could not find the 'session' cookie in the response. The authentication method may have changed." };
    }

    return { success: true, cookie: sessionCookie, username };

  } catch (e: any) {
    console.error("Kemono login request failed:", e);
    return { success: false, error: "A network error occurred during the login request. Please check your connection." };
  }
}


/**
 * Validates a session cookie by fetching the user's profile.
 * @param sessionCookie The session cookie to validate.
 * @returns The username on success.
 */
export async function validateSession(sessionCookie: string): Promise<{ success: true; username: string } | { success: false; error: string }> {
    if (!sessionCookie || !sessionCookie.trim().startsWith("session=")) {
        return { success: false, error: "Invalid session cookie format." };
    }

    const response = await kemonoApiRequest('/account/profile', { cookie: sessionCookie });

    if (response.success && response.data?.name) {
        return { success: true, username: response.data.name };
    } 
    
    if (!response.success) {
        return { success: false, error: `Session cookie is invalid or expired. API said: "${response.error}"` };
    } 
    
    return { success: false, error: "Failed to validate session. The API returned an unexpected response." };
}
