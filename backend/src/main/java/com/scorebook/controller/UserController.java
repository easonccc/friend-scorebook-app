package com.scorebook.controller;

import com.scorebook.common.Result;
import com.scorebook.entity.User;
import com.scorebook.interceptor.LoginInterceptor;
import com.scorebook.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户资料接口（全部需要登录：请求头带 Bearer token）。
 *
 * openid 从拦截器写入的 request attribute 取，Controller 自己不再解析 token，
 * 也不相信前端传来的任何 openid——「当前是谁」这件事只在后端发生一次。
 */
@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** 获取当前登录用户资料 */
    @GetMapping("/info")
    public Result info(HttpServletRequest request) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        User u = userService.getProfile(openid);
        // 前端契约：{ ok:true, user:{...} }
        return Result.ok("user", u);
    }

    /**
     * 修改头像 / 昵称。
     * 安全：Service 内部只接受 avatar / nickname，绝不修改 role（防普通用户伪造管理员）。
     */
    @PutMapping("/profile")
    public Result updateProfile(HttpServletRequest request,
                               @RequestBody Map<String, String> body) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        String avatar = body.get("avatar");
        String nickname = body.get("nickname");
        User u = userService.updateProfile(openid, avatar, nickname);
        return Result.ok("user", u);
    }

    /**
     * 列出全部用户（管理员专用）。
     * 权限集中在此处判断：非 admin 直接返回 FORBIDDEN，不在前端做安全判断。
     */
    @GetMapping("/list")
    public Result list(HttpServletRequest request) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        if (!userService.isAdmin(openid)) {
            return Result.fail("FORBIDDEN", "仅管理员可访问");
        }
        List<User> users = userService.listAll();
        return Result.ok("list", users);
    }
}
