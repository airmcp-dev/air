import { type FC } from 'react';
import { Link } from 'react-router-dom';

const NotFound: FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center">
      <div className="font-mono text-6xl font-extrabold text-text-muted/20 mb-4">404</div>
      <p className="text-text-secondary text-sm mb-6">Page not found</p>
      <Link to="/" className="btn-primary">
        <i className="fa-solid fa-arrow-left text-xs" /> Back to Home
      </Link>
    </div>
  </div>
);

export default NotFound;
