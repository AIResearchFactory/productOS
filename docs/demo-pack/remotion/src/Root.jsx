import React from 'react';
import {Composition} from 'remotion';
import {DemoPack, CaseStill} from './DemoPack';

export const Root = () => {
  return (
    <>
      <Composition id="DemoPack" component={DemoPack} durationInFrames={480} fps={30} width={1920} height={1080} />
      <Composition id="Case01" component={() => <CaseStill index={0} />} durationInFrames={1} fps={30} width={1920} height={1080} />
      <Composition id="Case02" component={() => <CaseStill index={1} />} durationInFrames={1} fps={30} width={1920} height={1080} />
      <Composition id="Case03" component={() => <CaseStill index={2} />} durationInFrames={1} fps={30} width={1920} height={1080} />
      <Composition id="Case04" component={() => <CaseStill index={3} />} durationInFrames={1} fps={30} width={1920} height={1080} />
    </>
  );
};
