package com.scorebook.interceptor;

import com.scorebook.common.Result;
import com.scorebook.common.TokenUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import tools.jackson.databind.ObjectMapper;

/**
 * 登录拦截器（Step 3 真实鉴权版）。
 *
 * 承担的安全职责（权限体系 Step 4 落地于此）：
 *   1. 从请求头 `Authorization: Bearer <token>` 取出 token；
 *   2. 调 TokenUtil.verify 校验签名 + 过期时间，解析出 openid；
 *   3. 把 openid 放进 request attribute（OPENID_ATTR），后续 Controller/Service 直接取，
 *      前端无法伪造——「谁在调用」只在服务端确定一次；
 *   4. 缺 token / 非法 / 过期 → 直接写 Result.fail(401) 并阻断，请求不会到达 Controller。
 *
 * 白名单（哪些路径不走这里）在 WebConfig 里配：/health、/api/auth/**（登录本身免鉴权）、Swagger 文档。
 */
@Component
public class LoginInterceptor implements HandlerInterceptor {

    /** Controller/Service 用这个 key 从 request 里取 openid */
    public static final String OPENID_ATTR = "openid";
    private static final String AUTH_PREFIX = "Bearer ";

    private final TokenUtil tokenUtil;
    private final ObjectMapper mapper = new ObjectMapper();

    public LoginInterceptor(TokenUtil tokenUtil) {
        this.tokenUtil = tokenUtil;
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith(AUTH_PREFIX)) {
            writeFail(response, 401, "UNAUTHORIZED", "缺少有效的 Authorization 头");
            return false;
        }
        String token = auth.substring(AUTH_PREFIX.length()).trim();
        try {
            String openid = tokenUtil.verify(token);
            request.setAttribute(OPENID_ATTR, openid);
            return true;
        } catch (IllegalArgumentException e) {
            writeFail(response, 401, "UNAUTHORIZED", e.getMessage());
            return false;
        }
    }

    private void writeFail(HttpServletResponse response, int status,
                           String code, String msg) throws Exception {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(mapper.writeValueAsString(Result.fail(code, msg)));
    }
}
