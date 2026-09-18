package com.scorebook.controller;

import com.scorebook.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 健康检查接口，仅用于验证脚手架「可独立跑」。
 * 后续业务接口都挂在 /api/* 下，这里不进入业务路径。
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Result health() {
        return Result.ok("status", "up");
    }
}
