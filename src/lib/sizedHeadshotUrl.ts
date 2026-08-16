/**
 * NFL headshots are delivered by Cloudinary, and the URLs in our data carry no
 * sizing transform — so the browser downloads the full studio original
 * (3400×2450, ~5 MB) to paint a 44 px circle. A list view mounts a hundred of
 * them, and Chrome then re-decodes those 8-megapixel images every time the
 * viewport changes, because its decoded-bitmap cache cannot hold ~900
 * megapixels of source imagery and thrashes.
 *
 * Measured on `/highlights` with the lists expanded: ~840 ms of work per resize
 * unsized, ~4 ms sized. Asking the CDN for the crop we actually paint is the
 * whole fix.
 */

/**
 * Widths we are willing to request, in device pixels.
 *
 * Requests snap **up** to one of these rather than using the exact pixel width
 * a call site needs. Every derivative is a separate CDN cache entry and a
 * separate decode, so the 28/32/36/44 px avatars scattered across the list
 * views sharing two buckets is worth more than each getting a perfect fit.
 */
export const HEADSHOT_WIDTH_BUCKETS = [64, 96, 128, 256] as const;

/**
 * Cloudinary delivery URLs, whose path is
 * `/image/{upload|private}/{transformations}/{public id}`. Both delivery types
 * appear in our data. The transformation segment is captured separately so we
 * can extend it rather than replace it — dropping `f_auto,q_auto` would cost us
 * WebP and automatic quality.
 */
const CLOUDINARY_DELIVERY =
  /^(https:\/\/static\.www\.nfl\.com\/image\/(?:upload|private)\/)([^/]+)(\/.+)$/;

/** A transformation segment that already constrains width. */
const ALREADY_SIZED = /(^|,)w_\d+(,|$)/;

/**
 * Assume two device pixels per CSS pixel. Reading the real `devicePixelRatio`
 * would fit each display exactly, but it would also make this impure, fragment
 * the CDN cache across visitors, and hand a 1× laptop a crop that turns soft
 * the moment the window moves to an external retina display.
 */
const PIXEL_RATIO = 2;

/**
 * The smallest bucket that covers `size` CSS pixels at {@link PIXEL_RATIO},
 * falling back to the largest bucket for anything bigger than we serve.
 */
function bucketFor(size: number): number {
  const wanted = size * PIXEL_RATIO;
  return (
    HEADSHOT_WIDTH_BUCKETS.find((bucket) => bucket >= wanted) ??
    HEADSHOT_WIDTH_BUCKETS[HEADSHOT_WIDTH_BUCKETS.length - 1]
  );
}

/**
 * `src` rewritten to request a square crop about `size` CSS pixels wide, or
 * `src` unchanged when it is not a URL we know how to resize.
 *
 * Returns `undefined` for a missing `src` so callers can keep branching on
 * truthiness to decide between the photo and their own placeholder.
 *
 * @param src Headshot URL from the draft data, if the player has one.
 * @param size Rendered width of the avatar in CSS pixels.
 */
export function sizedHeadshotUrl(
  src: string | undefined,
  size: number,
): string | undefined {
  if (!src) return undefined;

  const match = CLOUDINARY_DELIVERY.exec(src);
  if (!match) return src;

  const [, delivery, transformations, publicId] = match;
  // Stacking a second width on an already-sized URL would miss the cache entry
  // the first one warmed, and Cloudinary would apply both crops in sequence.
  if (ALREADY_SIZED.test(transformations)) return src;

  const width = bucketFor(size);
  // `c_fill,g_face` fills the square by cropping around the detected face
  // rather than letterboxing — these are wide portraits shown in a circle, so
  // an uncropped fit would shrink the head to nothing.
  return `${delivery}${transformations},w_${width},h_${width},c_fill,g_face${publicId}`;
}
