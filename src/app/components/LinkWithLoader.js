'use client';
import Link from 'next/link';
import { useRouteLoader } from './RouteLoader';

export default function LinkWithLoader({ href, children, className, ...props }) {
  const { triggerRouteChange } = useRouteLoader();

  const handleClick = (e) => {
    e.preventDefault();
    triggerRouteChange(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}
