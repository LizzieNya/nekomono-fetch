


# Nekomono Fetch

Nekomono Fetch is an unofficial web interface for interacting with the [Kemono.su](https://kemono.su/)  [API](https://kemono.su/documentation/api). It provides a user-friendly way to fetch posts from creators, look up specific posts, manage a local list of favorite creators, and perform account-level actions like importing favorites from your Kemono account.

This project is built with Next.js, TypeScript, ShadCN UI, and Tailwind CSS.

## Features

-   **Fetch by Creator:** Retrieve all posts from a specific creator by providing their service and ID.
-   **Fetch by Post:** Look up a single post by its unique ID.
-   **Local Favorites:** Save your favorite creators for quick access. This list is stored securely in your browser's local storage.
-   **Account Integration:**
    -   Log in to your Kemono account using credentials or a session cookie.
    -   Import your entire list of followed artists from your Kemono account directly into your local favorites.
    -   Request an immediate update for a creator's profile (requires login).
-   **Responsive Design:** A clean, modern interface that works seamlessly on desktop and mobile devices.

## Getting Started

To run this project locally:

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Run the development server: `npm run dev`

The application will be available at `http://localhost:3000`.

## License

This project is open-source and available under the MIT License. See the `LICENSE` file for more details.

## Credits

This project is maintained by [LizzieNya](https://github.com/lizzienya)
