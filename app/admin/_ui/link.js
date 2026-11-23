// next/link, without preloading. Preloading every link on screen sent dozens of requests at once,
// which the host's firewall treats as an attack and answers by blocking the visitor's address.
import NextLink from 'next/link';

export default function Link(props) {
  return <NextLink prefetch={false} {...props} />;
}
