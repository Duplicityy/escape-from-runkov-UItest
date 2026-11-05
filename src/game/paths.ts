// Where the files in public/ are served from. In dev that's the root; a
// build uses relative paths (vite.config.ts), so it runs from a sub-folder
// on a host like itch.io as well as from a root.
export function assetUrl(path: string): string {
    return import.meta.env.BASE_URL + path;
}
