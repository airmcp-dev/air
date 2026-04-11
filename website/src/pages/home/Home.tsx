import { type FC } from 'react';
import { Hero, Features, CodeExample, Packages } from '@/components/sections';

const Home: FC = () => (
  <>
    <Hero />
    <Features />
    <CodeExample />
    <Packages />
  </>
);

export default Home;
