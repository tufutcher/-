export const state = {
  user: null,
  profile: null,
  profiles: [],
  checkins: [],
  view: "wall",
  listeners: new Set()
};

export function setState(patch){
  Object.assign(state, patch);
  notify();
}

export function subscribe(fn){
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function notify(){
  state.listeners.forEach(fn => fn(state));
}
