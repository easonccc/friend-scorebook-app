package com.scorebook.common;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/**
 * 统一响应体。
 *
 * 为什么做成「扁平结构」而不是 { ok, data:{...} }：
 * 前端 utils/db.js / services/user.js 判断成功用的是 `r.ok === false`，
 * 且成功数据（space / list / user / record / patch ...）是平铺在响应根级的，
 * 例如云函数返回 { ok:true, space:{...} }。这里保持同样的形状，前端才能零改动对接。
 */
public class Result implements Serializable {

    private boolean ok;
    private String code;
    private String msg;
    private final Map<String, Object> extra = new HashMap<>();

    public static Result ok() {
        Result r = new Result();
        r.ok = true;
        r.code = "OK";
        return r;
    }

    /** 成功并附带一个根级字段，例如 Result.ok("space", space) -> { ok:true, code:"OK", space:{...} } */
    public static Result ok(String key, Object value) {
        Result r = ok();
        r.extra.put(key, value);
        return r;
    }

    public static Result fail(String code, String msg) {
        Result r = new Result();
        r.ok = false;
        r.code = code;
        r.msg = msg;
        return r;
    }

    public boolean isOk() { return ok; }
    public void setOk(boolean ok) { this.ok = ok; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getMsg() { return msg; }
    public void setMsg(String msg) { this.msg = msg; }

    /** 让 extra 里的键值平铺到 JSON 根级，保持与前端契约一致 */
    @JsonAnyGetter
    public Map<String, Object> getExtra() { return extra; }
}
