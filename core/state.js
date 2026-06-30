export const state = {
  user: null,
  profile: null,
  checkins: [],
  view: "wall",
  listeners: new Set()
};

// 设置状态（核心）
export function setState(patch){
  Object.assign(state, patch);
  notify();
}

// 监听状态变化
export function subscribe(fn){
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

// 通知所有页面更新
function notify(){
  state.listeners.forEach(fn => fn(state));
}
