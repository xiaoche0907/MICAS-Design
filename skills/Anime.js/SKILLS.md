# 📄 skills.md - Anime.js 动画库速查手册

markdown

# Anime.js 动画库技能手册

> 轻量级、高性能的 JavaScript 动画引擎，适用于 Web 交互动画开发
> 
> 官网: https://animejs.com/
> GitHub: https://github.com/juliangarnier/anime
> 文档: https://animejs.com/documentation

---

## 📦 安装与引入

### NPM 安装

bash
npm install animejs

### ES Module 引入 (推荐)

javascript
import { animate, stagger, createTimeline, createDraggable, createSpring } from 'animejs';

### CDN 引入

html

<script src="https://cdn.jsdelivr.net/npm/animejs@4/lib/anime.min.js"></script>

---

## 🎯 核心 API

### 1. animate() - 基础动画

**语法:**
javascript
animate(targets, properties, options?)

**基础示例:**
javascript
// 简单位移 + 旋转
animate('.box', {
x: 250,
rotate: 360,
duration: 1000,
ease: 'inOutQuad'
});

// 从指定值开始
animate('.box', {
x: { from: -100, to: 100 },
opacity: { from: 0, to: 1 }
});

// 多关键帧
animate('.box', {
x: [0, 100, 50, 150],
duration: 2000
});

**Targets 选择器:**
javascript
// CSS 选择器
animate('.class', { ... })
animate('#id', { ... })
animate('div', { ... })

// DOM 元素
animate(document.querySelector('.box'), { ... })

// NodeList
animate(document.querySelectorAll('.box'), { ... })

// 数组
animate([el1, el2, el3], { ... })

// JavaScript 对象
const obj = { value: 0 };
animate(obj, { value: 100 }, {
onUpdate: () => console.log(obj.value)
});

---

### 2. 可动画属性

#### CSS 属性

javascript
animate('.el', {
// 尺寸
width: '200px',
height: 100,

// 颜色
backgroundColor: '#FF5733',
color: 'rgb(255, 0, 0)',
borderColor: 'hsl(120, 100%, 50%)',

// 边框/圆角
borderRadius: '50%',
borderWidth: '5px',

// 透明度
opacity: 0.5,

// 其他
boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
filter: 'blur(5px)'
});

#### CSS Transform (独立控制)

javascript
animate('.el', {
x: 100,           // translateX
y: 50,            // translateY
z: 20,            // translateZ
rotate: 45,       // rotate (deg)
rotateX: 30,      // rotateX
rotateY: 60,      // rotateY
rotateZ: 90,      // rotateZ
scale: 1.5,       // scale
scaleX: 2,        // scaleX
scaleY: 0.5,      // scaleY
skew: 10,         // skew
skewX: 15,        // skewX
skewY: 20         // skewY
});

#### SVG 属性

javascript
animate('circle', {
cx: 200,
cy: 150,
r: 50,
fill: '#FF0000',
stroke: '#000',
strokeWidth: 3,
strokeDashoffset: [1000, 0]  // 描边动画
});

animate('path', {
d: 'M10 10 L 100 100'  // 路径变形
});

#### DOM 属性

javascript
animate('.el', {
scrollTop: 500,
scrollLeft: 200,
value: 100  // input 元素
});

---

### 3. 动画参数

javascript
animate('.el', {
x: 200
}, {
// 时间控制
duration: 1000,        // 持续时间 (ms)
delay: 500,            // 延迟 (ms)

// 循环控制
loop: true,            // 无限循环
loop: 3,               // 循环3次
alternate: true,       // 往返播放
reversed: true,        // 反向播放

// 缓动函数
ease: 'easeOutElastic',

// 播放控制
autoplay: true,        // 自动播放
autoplay: false,       // 手动控制

// 帧率
fps: 60,

// 播放速度
speed: 1.5,

// 持久化 (动画结束后保持样式)
persist: true
});

---

### 4. stagger() - 交错动画

javascript
import { animate, stagger } from 'animejs';

// 基础交错延迟
animate('.item', {
x: 100,
delay: stagger(100)  // 每个元素延迟 100ms
});

// 从中心开始
animate('.item', {
scale: [0, 1],
delay: stagger(50, { from: 'center' })
});

// 从特定索引开始
animate('.item', {
y: -20,
delay: stagger(100, { from: 5 })
});

// 交错值
animate('.item', {
x: stagger(50),              // x: 0, 50, 100, 150...
rotate: stagger([0, 360]),   // 在范围内分布
scale: stagger([1, 0.5], { from: 'center' })
});

// 网格布局交错
animate('.grid-item', {
scale: [0, 1],
delay: stagger(50, {
grid: [10, 10],
from: 'center'
})
});

// easing 交错
animate('.item', {
x: 100,
delay: stagger(100, { ease: 'easeOutQuad' })
});

---

### 5. createTimeline() - 时间轴

javascript
import { createTimeline, stagger } from 'animejs';

const tl = createTimeline({
duration: 500,
ease: 'outExpo'
});

// 顺序添加动画
tl.add('.box1', { x: 100 })
.add('.box2', { y: 100 })
.add('.box3', { rotate: 360 });

// 时间位置控制
tl.add('.a', { x: 100 })
.add('.b', { y: 100 }, '<')      // 与上一个同时开始
.add('.c', { scale: 2 }, '>')    // 上一个结束后开始
.add('.d', { opacity: 0 }, '-=200')  // 提前 200ms
.add('.e', { rotate: 90 }, '+=100'); // 延后 100ms

// 绝对时间
tl.add('.box', { x: 100 }, 1000);  // 在 1000ms 处开始

// 播放控制
tl.play();
tl.pause();
tl.restart();
tl.reverse();
tl.seek(500);  // 跳转到 500ms

---

### 6. 缓动函数 (Easing)

#### 内置缓动

javascript
// 基础类型: in, out, inOut
'inQuad', 'outQuad', 'inOutQuad',
'inCubic', 'outCubic', 'inOutCubic',
'inQuart', 'outQuart', 'inOutQuart',
'inQuint', 'outQuint', 'inOutQuint',
'inSine', 'outSine', 'inOutSine',
'inExpo', 'outExpo', 'inOutExpo',
'inCirc', 'outCirc', 'inOutCirc',
'inBack', 'outBack', 'inOutBack',
'inElastic', 'outElastic', 'inOutElastic',
'inBounce', 'outBounce', 'inOutBounce'

// 线性
'linear'

#### 自定义缓动

javascript
// 幂次缓动
animate('.el', { x: 100, ease: 'inOut(3)' });

// 贝塞尔曲线
import { cubicBezier } from 'animejs';
animate('.el', {
x: 100,
ease: cubicBezier(0.7, 0.1, 0.5, 0.9)
});

// 步进函数
import { steps } from 'animejs';
animate('.el', { x: 100, ease: steps(5) });

---

### 7. createSpring() - 弹簧动画

javascript
import { animate, createSpring } from 'animejs';

// 弹跳效果
animate('.el', {
x: 200,
ease: createSpring({
stiffness: 100,   // 刚度
damping: 10,      // 阻尼
})
});

// 或使用 bounce + duration
animate('.el', {
y: -100,
ease: createSpring({
bounce: 0.5,      // 弹跳程度 0-1
duration: 800
})
});

---

### 8. createDraggable() - 拖拽

javascript
import { createDraggable, createSpring } from 'animejs';

// 基础拖拽
createDraggable('.draggable');

// 带弹簧释放
createDraggable('.box', {
releaseEase: createSpring({
stiffness: 120,
damping: 6
})
});

// 限制拖拽区域
createDraggable('.box', {
container: '.container',  // 限制在容器内
x: { min: 0, max: 500 },  // x 轴范围
y: { min: 0, max: 300 }   // y 轴范围
});

// 吸附到网格
createDraggable('.box', {
snap: {
x: 50,  // x 轴吸附间隔
y: 50   // y 轴吸附间隔
}
});

// 回调
createDraggable('.box', {
onGrab: (draggable) => console.log('grabbed'),
onDrag: (draggable) => console.log('dragging'),
onRelease: (draggable) => console.log('released'),
onSnap: (draggable) => console.log('snapped')
});

---

### 9. onScroll() - 滚动触发动画

javascript
import { animate, onScroll } from 'animejs';

// 基础滚动触发
animate('.el', {
x: 200,
autoplay: onScroll()
});

// 滚动同步
animate('.el', {
y: [-100, 100],
autoplay: onScroll({ sync: true })  // 动画进度与滚动同步
});

// 自定义阈值
animate('.el', {
opacity: [0, 1],
autoplay: onScroll({
enter: 'top bottom',    // 进入时机
leave: 'bottom top',    // 离开时机
})
});

// 滚动容器
animate('.el', {
x: 100,
autoplay: onScroll({
container: '.scroll-container'
})
});

---

### 10. SVG 工具

#### 路径描边动画

javascript
import { animate, createDrawable } from 'animejs';

animate(createDrawable('path'), {
draw: ['0 0', '0 1'],  // 从无到完整描边
duration: 2000,
ease: 'inOutQuad'
});

#### 路径变形

javascript
import { animate, morphTo } from 'animejs';

animate('.path-a', {
d: morphTo('.path-b'),
duration: 1000
});

#### 沿路径运动

javascript
import { animate, createMotionPath } from 'animejs';

animate('.element', {
...createMotionPath('.motion-path'),
duration: 3000,
ease: 'linear',
loop: true
});

---

### 11. 播放控制

javascript
const animation = animate('.el', {
x: 200,
autoplay: false
});

// 控制方法
animation.play();          // 播放
animation.pause();         // 暂停
animation.restart();       // 重新开始
animation.reverse();       // 反向
animation.seek(500);       // 跳转到指定时间
animation.complete();      // 立即完成

// 属性
animation.currentTime;     // 当前时间
animation.progress;        // 进度 0-1
animation.paused;          // 是否暂停
animation.completed;       // 是否完成

// Promise
await animation.finished;  // 等待完成

---

### 12. 回调函数

javascript
animate('.el', {
x: 200
}, {
onBegin: (anim) => console.log('动画开始'),
onUpdate: (anim) => console.log('更新中', anim.progress),
onLoop: (anim) => console.log('循环'),
onComplete: (anim) => console.log('完成'),
onPause: (anim) => console.log('暂停'),
onPlay: (anim) => console.log('播放')
});

---

### 13. createScope() - 响应式动画

javascript
import { createScope, createTimeline } from 'animejs';

createScope({
mediaQueries: {
mobile: '(max-width: 768px)',
desktop: '(min-width: 769px)'
}
}).add(({ matches }) => {
if (matches.mobile) {
// 移动端动画
createTimeline().add('.box', { x: 50 });
} else {
// 桌面端动画
createTimeline().add('.box', { x: 200 });
}
});

---

## 🎨 常用动画模式

### 淡入淡出

javascript
// 淡入
animate('.el', { opacity: [0, 1], duration: 500 });

// 淡出
animate('.el', { opacity: [1, 0], duration: 500 });

### 滑入效果

javascript
// 从左滑入
animate('.el', {
x: [-100, 0],
opacity: [0, 1],
duration: 600,
ease: 'outExpo'
});

// 从下滑入
animate('.el', {
y: [50, 0],
opacity: [0, 1],
duration: 600,
ease: 'outExpo'
});

### 弹跳进入

javascript
animate('.el', {
scale: [0, 1],
ease: 'outElastic',
duration: 1000
});

### 抖动效果

javascript
animate('.el', {
x: [-10, 10, -10, 10, 0],
duration: 400,
ease: 'easeInOutSine'
});

### 脉冲效果

javascript
animate('.el', {
scale: [1, 1.1, 1],
duration: 600,
loop: true
});

### 打字机效果

javascript
import { animate, stagger } from 'animejs';

animate('.char', {
opacity: [0, 1],
y: [20, 0],
delay: stagger(50),
ease: 'outExpo'
});

### 数字滚动

javascript
const obj = { count: 0 };
animate(obj, {
count: 1000
}, {
duration: 2000,
ease: 'outExpo',
onUpdate: () => {
document.querySelector('.counter').textContent = Math.round(obj.count);
}
});

### 视差滚动

javascript
animate('.parallax-bg', {
y: [0, -200],
autoplay: onScroll({ sync: true })
});

---

## 📊 包体积参考

| 模块 | 大小 |
|------|------|
| Timer | 5.60 KB |
| Animation | +5.20 KB |
| Timeline | +0.55 KB |
| Animatable | +0.40 KB |
| Draggable | +6.41 KB |
| Scroll | +4.30 KB |
| Scope | +0.22 KB |
| SVG | 0.35 KB |
| Stagger | +0.48 KB |
| Spring | 0.52 KB |
| WAAPI | 3.50 KB |
| **总计** | **~27 KB** |

---

## 🔗 相关资源

- 📖 [官方文档](https://animejs.com/documentation)
- 💻 [GitHub 仓库](https://github.com/juliangarnier/anime)
- 🎯 [从 v3 迁移到 v4](https://github.com/juliangarnier/anime/wiki/Migrating-from-v3-to-v4)
- 📦 [NPM 包](https://www.npmjs.com/package/animejs)

---

> 💡 **提示**: Anime.js v4 采用 ESM-first 设计，支持极佳的 Tree Shaking，按需引入可大幅减小包体积。

---

这份 `skills.md` 包含了：

1. **安装与引入** - NPM 和 CDN 两种方式
2. **核心 API** - animate、stagger、timeline 等完整用法
3. **所有可动画属性** - CSS、Transform、SVG、DOM
4. **完整参数说明** - 时间、循环、缓动等
5. **高级功能** - 弹簧动画、拖拽、滚动触发、SVG 工具
6. **常用动画模式** - 淡入淡出、滑入、弹跳、抖动等现成代码
7. **包体积参考** - 便于性能优化决策

你可以直接复制这份文档到项目中使用。有什么需要补充或调整的吗？

