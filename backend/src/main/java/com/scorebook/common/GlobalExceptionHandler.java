package com.scorebook.common;

import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器：把 Service / Controller 抛出的异常，统一转成前端契约的 Result 形状
 * （{ ok:false, code, msg }），避免 Spring 默认把异常打成 500 堆栈、前端无法识别。
 *
 * 常见异常映射：
 *   IllegalArgumentException → 参数/业务校验失败（如头像不在白名单、昵称非法、token 过期在 Service 层抛出时）
 *   其余 Exception          → 兜底为 INTERNAL_ERROR
 *
 * 注意：登录拦截器里「无 token / token 非法」是直接写响应（不走这里），
 * 因为那时还没进入 Controller，Spring 异常机制管不到。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public Result handleIllegalArgument(IllegalArgumentException e) {
        return Result.fail("INVALID_PARAM",
                e.getMessage() == null ? "参数错误" : e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public Result handleOther(Exception e) {
        return Result.fail("INTERNAL_ERROR", "服务异常：" + e.getMessage());
    }
}
