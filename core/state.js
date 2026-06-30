export const state = {
  user: null,
  profile: null,
  profiles: [],
  checkins: [],
  view: "wall",
  viewUserId: null,
  listeners: new Set()
};

export function setState(patch){
  Object.assign(state, patch);
  notify();
}

export function subscribe(fn){
  if(typeof fn !== "function"){
    console.error("subscribe 需要传入函数，但收到：", fn);
    return () => {};
  }

  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function notify(){
  state.listeners.forEach(fn => fn(state));
}
