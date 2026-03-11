import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, interpolate} from 'remotion';
import {captions} from './captions';

const Card = ({title, caption}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{backgroundColor: '#0b1220', color: 'white', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, Arial'}}>
      <div style={{width: 1200, border: '1px solid #2a3a57', borderRadius: 24, padding: 48, background: '#101a2e', opacity}}>
        <div style={{fontSize: 28, color: '#7dd3fc', marginBottom: 16}}>productOS Demo Case</div>
        <div style={{fontSize: 54, fontWeight: 700, marginBottom: 24}}>{title}</div>
        <div style={{fontSize: 34, lineHeight: 1.35, color: '#dbeafe'}}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
};

export const DemoPack = () => {
  const chunk = 120;
  return (
    <AbsoluteFill>
      {captions.map((c, i) => (
        <Sequence key={c.id} from={i * chunk} durationInFrames={chunk}>
          <Card title={c.title} caption={c.caption} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const CaseStill = ({index = 0}) => {
  const c = captions[index];
  return <Card title={c.title} caption={c.caption} />;
};
