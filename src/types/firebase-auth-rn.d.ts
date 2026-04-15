/**
 * Module augmentation to expose getReactNativePersistence from @firebase/auth.
 *
 * The @firebase/auth package exports this function under the "react-native"
 * condition in its package.json, but TypeScript resolves the "types" condition
 * first (auth-public.d.ts), which does not include it. This declaration merges
 * the missing export into the module so tsc is satisfied.
 *
 * At runtime, Metro (Expo bundler) correctly resolves to the react-native
 * entry point via the "react-native" field in package.json.
 */

// Makes this a module file so that the declare module below is treated as an
// augmentation (merge), not as a replacement of the existing @firebase/auth types.
export {};

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: object): import('@firebase/auth').Persistence;
}
