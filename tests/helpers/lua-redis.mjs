// Execute the actual Lua scripts in a Lua VM with Redis command semantics.
// This is not a hosted Upstash integration test.
import { lua, lauxlib, lualib, to_luastring, to_jsstring } from 'fengari'
function push(L, value) {
 if(value===null || value===undefined)lua.lua_pushnil(L)
 else if(typeof value==='string')lua.lua_pushstring(L,to_luastring(value))
 else if(typeof value==='number')lua.lua_pushnumber(L,value)
 else if(typeof value==='boolean')lua.lua_pushboolean(L,value)
 else {lua.lua_newtable(L);for(const [k,v]of Object.entries(value)){push(L,Array.isArray(value)?Number(k)+1:k);push(L,v);lua.lua_settable(L,-3)}}
}
function read(L,index) {
 const type=lua.lua_type(L,index)
 if(type===lua.LUA_TNIL)return null
 if(type===lua.LUA_TSTRING)return to_jsstring(lua.lua_tostring(L,index))
 if(type===lua.LUA_TNUMBER)return lua.lua_tonumber(L,index)
 if(type===lua.LUA_TBOOLEAN)return lua.lua_toboolean(L,index)
 if(type===lua.LUA_TTABLE){const out={};index=lua.lua_absindex(L,index);lua.lua_pushnil(L);while(lua.lua_next(L,index)){out[read(L,-2)]=read(L,-1);lua.lua_pop(L,1)}const keys=Object.keys(out);return keys.length&&keys.every(k=>/^\d+$/.test(k))?keys.sort((a,b)=>a-b).map(k=>out[k]):out}
 throw new Error('unsupported Lua value')
}
export class LuaRedis {
 rows=new Map(); lists=new Map(); ttls=new Map(); failBefore=false; failAfter=false
 async get(key){return this.rows.get(key)??null}
 async eval(script, keys, args) {
 if(this.failBefore){this.failBefore=false;throw new Error('simulated connection interruption')}
 const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L)
 push(L,keys);lua.lua_setglobal(L,to_luastring('KEYS'));push(L,args);lua.lua_setglobal(L,to_luastring('ARGV'))
 lua.lua_newtable(L)
 lua.lua_pushjsfunction(L,L=>{const command=read(L,1);const key=read(L,2);if(command==='GET')push(L,this.rows.get(key)??null);else if(command==='INCR'){const n=Number(this.rows.get(key)??0)+1;this.rows.set(key,String(n));push(L,n)}else if(command==='SET'){this.rows.set(key,read(L,3));push(L,'OK')}else if(command==='LLEN')push(L,(this.lists.get(key)??[]).length);else if(command==='RPUSH'){const list=this.lists.get(key)??[];list.push(String(read(L,3)));this.lists.set(key,list);push(L,list.length)}else if(command==='EXPIRE'){this.ttls.set(key,Number(read(L,3)));push(L,1)}else throw new Error(command);return 1});lua.lua_setfield(L,-2,to_luastring('call'));lua.lua_setglobal(L,to_luastring('redis'))
 lua.lua_newtable(L)
 lua.lua_pushjsfunction(L,L=>{push(L,JSON.parse(read(L,1)));return 1});lua.lua_setfield(L,-2,to_luastring('decode'))
 lua.lua_pushjsfunction(L,L=>{push(L,JSON.stringify(read(L,1)));return 1});lua.lua_setfield(L,-2,to_luastring('encode'));lua.lua_setglobal(L,to_luastring('cjson'))
 const status=lauxlib.luaL_dostring(L,to_luastring(script));if(status!==lua.LUA_OK)throw new Error(read(L,-1))
 const result=read(L,-1);lua.lua_close(L)
 if(this.failAfter){this.failAfter=false;throw new Error('lost acknowledgement after commit')}
 return result
 }
}
