import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, interpolate} from 'remotion';
import {captions} from './captions';

const Card = ({title, caption, goal, output, success}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{backgroundColor: '#0b1220', color: 'white', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, Arial'}}>
      <div style={{width: 1320, border: '1px solid #2a3a57', borderRadius: 24, padding: 44, background: '#101a2e', opacity}}>
        <div style={{fontSize: 24, color: '#7dd3fc', marginBottom: 12}}>productOS Demo Case</div>
        <div style={{fontSize: 50, fontWeight: 700, marginBottom: 18}}>{title}</div>
        <div style={{fontSize: 30, lineHeight: 1.28, color: '#dbeafe', marginBottom: 24}}>{caption}</div>
        <div style={{fontSize: 24, lineHeight: 1.5, color: '#cbd5e1'}}>
          <div><span style={{color:'#93c5fd'}}>Goal:</span> {goal}</div>
          <div><span style={{color:'#93c5fd'}}>Output:</span> {output}</div>
          <div><span style={{color:'#93c5fd'}}>Success:</span> {success}</div>
        </div>
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
          <Card title={c.title} caption={c.caption} goal={c.goal} output={c.output} success={c.success} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const CaseStill = ({index = 0}) => {
  const c = captions[index];
  return <Card title={c.title} caption={c.caption} goal={c.goal} output={c.output} success={c.success} />;
};
