export const events = {
  map: {},

  on(e,fn){
    this.map[e] = this.map[e] || [];
    this.map[e].push(fn);
  },

  emit(e,data){
    (this.map[e]||[]).forEach(fn=>fn(data));
  }
};
