package com.scorebook.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 登录拦截器（Step 1 占位版）。
 *
 * 它未来要承担的角色（权限体系 Step 4 落地）：
 *   1. 从请求头 `Authorization: Bearer <token>` 取出 token；
 *   2. 校验 token 合法性，解析出当前用户的 openid；
 *   3. 把 openid 放进 request attribute，供后续 Controller / Service 直接拿，
 *      这样「谁在调用」这件事只在后端发生一次，前端无法伪造；
 *   4. 非法/缺失 token 的请求，直接写 Result.fail(...) 并返回 false 阻断。
 *
 * 为什么权限判断要放在拦截器（后端）而不是前端：
 *   前端代码在用户设备上，role / openid 都能被篡改或绕过。真正的安全边界必须在
 *   服务端，且尽量集中，避免几十个页面各自写 if (role === 'admin')。
 *
 * 当前阶段（Step 1）：还没有用户表、没有 token 体系，为了让脚手架「可独立跑」，
 * preHandle 暂时一律放行（return true）。Step 4 会在这里补上真实校验逻辑。
 */
@Component
public class LoginInterceptor implements HandlerInterceptor {

    /** 解析出的 openid 在 request 中的 attribute 名，Controller/Service 用这个 key 取 */
    public static final String OPENID_ATTR = "openid";

    @Override
    public boolean preHandle(HttpServletRequest request,
                            HttpServletResponse response,
                            Object handler) {
        // Step 1 占位：先放行，保证脚手架能独立启动。
        // 后续（Step 4）在这里做 token 校验逻辑，见类注释上方说明。
        return true;
    }
}
