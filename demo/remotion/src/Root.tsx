import React from 'react';
import {Composition} from 'remotion';
import {ProductOSMondayDemo} from './scenes/ProductOSMondayDemo';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductOSMondayDemo"
        component={ProductOSMondayDemo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
