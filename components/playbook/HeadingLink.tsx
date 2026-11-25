'use client';

import { useEffect, useState } from 'react';
import CopyButton from './CopyButton';

/**
 * The copy-link control beside an H2.
 *
 * The URL has to be built in the browser: the same chapter is served from
 * localhost, from a preview deployment and from the live domain, and a link
 * copied from one should not point at another. That makes this a client
 * component, and it renders nothing until it knows the origin.
 */
export default function HeadingLink({ id, label }: { id: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}${window.location.pathname}#${id}`);
  }, [id]);

  if (!url) return null;
  return <CopyButton value={url} label={label} copiedLabel="Copied" />;
}
