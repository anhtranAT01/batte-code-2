import {useEffect,useRef,useState} from 'react';

// Live mode follows incoming snapshots immediately. Only deliberate replay uses a timer.
export function useLivePlayback({totalSteps,loading,active}) {
  const [manualStep,setManualStep]=useState(0);
  const [followLive,setFollowLive]=useState(true);
  const [playing,setPlaying]=useState(false);
  const [playSpeed,setPlaySpeed]=useState(1);
  const latest=useRef(totalSteps);
  latest.current=totalSteps;
  const lastStep=Math.max(0,totalSteps-1);
  const currentStepIdx=followLive ? lastStep : Math.min(manualStep,lastStep);

  useEffect(()=>{
    if(!active || followLive || !playing)return;
    const timer=setInterval(()=>{
      setManualStep(step=>Math.min(step+1,Math.max(0,latest.current-1)));
    },Math.max(120,700/playSpeed));
    return()=>clearInterval(timer);
  },[active,followLive,playing,playSpeed]);
  useEffect(()=>{
    if(!loading && manualStep>=lastStep)setPlaying(false);
  },[loading,manualStep,lastStep]);

  const setCurrentStepIdx=value=>{
    setManualStep(Math.max(0,Math.min(lastStep,typeof value==='function'?value(currentStepIdx):value)));
    setFollowLive(false);
    setPlaying(false);
  };
  const returnToLive=()=>{setFollowLive(true);setPlaying(false);};
  const resetPlayback=()=>{setManualStep(0);returnToLive();};
  const togglePlayback=()=>{
    if(followLive){
      setManualStep(loading?currentStepIdx:0);
      setFollowLive(false);
      setPlaying(!loading);
    }else if(!loading && currentStepIdx>=lastStep){
      setManualStep(0);setPlaying(true);
    }else setPlaying(value=>!value);
  };
  return {currentStepIdx,setCurrentStepIdx,followLive,returnToLive,resetPlayback,
    isPlaying:followLive?loading:playing,setIsPlaying:setPlaying,playSpeed,setPlaySpeed,togglePlayback};
}
