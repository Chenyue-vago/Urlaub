// 本地补丁：date-holidays-parser 包内有 types/index.d.ts，但 package.json 的 exports
// 字段没有声明 "types" 导出条件，导致 moduleResolution: "bundler" 解析不到。
// 这里直接转引官方的类型声明文件即可。
declare module 'date-holidays-parser' {
  export * from 'date-holidays-parser/types/index';
  export { default } from 'date-holidays-parser/types/index';
}
