import { Link } from 'react-router-dom';
import { prefetchRoute } from './routeModules';
export default function PrefetchLink({ to, children, ...props }) {
  const prepare = () => prefetchRoute(to);
  return <Link {...props} to={to} onPointerEnter={prepare} onPointerDown={prepare} onFocus={prepare}>{children}</Link>;
}
