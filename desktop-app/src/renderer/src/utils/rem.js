// 设置 rem 函数
function setRem() {
  // 750 是设计稿的宽度
  const designWidth = 750;
  // 100 是一个基准值，方便 px 与 rem 的计算
  const baseVal = 100;
  const docEl = document.documentElement;
  // 计算根元素的 font-size
  let clientWidth = docEl.clientWidth;

  // 当屏幕宽度超过设计稿宽度时，将用于计算的宽度固定为设计稿宽度
  // 这样可以确保在PC端时，rem计算出的fontSize不会过大
  if (clientWidth > designWidth) {
    clientWidth = designWidth;
  }
  
  if (clientWidth) {
    docEl.style.fontSize = baseVal * (clientWidth / designWidth) + 'px';
  }
}

// 初始化
setRem();

// 监听窗口变化
window.addEventListener('resize', setRem);
window.addEventListener('pageshow', function (e) {
  if (e.persisted) {
    setRem();
  }
});
