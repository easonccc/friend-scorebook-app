package com.scorebook.controller;

import com.scorebook.common.Result;
import com.scorebook.common.TokenUtil;
import com.scorebook.service.UserService;
import com.scorebook.service.WechatService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

/**
 * 登录接口（唯一对外「免鉴权」的用户入口）。
 *
 * 数据流：
 *   小程序 wx.login() 拿临时 code
 *     → 前端 POST /api/auth/login { code }
 *     → 后端 WechatService 用 code 换 openid（secret 只在后端，前端看不到也无法伪造）
 *     → UserService.initUser(openid) 不存在则新建用户（角色由后端白名单判定）
 *     → TokenUtil 签发无状态 token 返回给前端
 *   前端之后每次请求都在 Header 带 Authorization: Bearer <token>
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final WechatService wechatService;
    private final UserService userService;
    private final TokenUtil tokenUtil;

    public AuthController(WechatService wechatService,
                          UserService userService,
                          TokenUtil tokenUtil) {
        this.wechatService = wechatService;
        this.userService = userService;
        this.tokenUtil = tokenUtil;
    }

    @PostMapping("/login")
    public Result login(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank()) {
            return Result.fail("INVALID_PARAM", "缺少 code");
        }
        // ① 用 code 换 openid（这一步替代云开发的 getWXContext().OPENID）
        String openid = wechatService.code2Session(code);
        // ② 初始化用户：首访建表记录，角色后端判定；已存在则原样返回
        userService.initUser(openid);
        // ③ 签发 token
        String token = tokenUtil.generate(openid);
        // 前端契约：{ ok:true, token:"..." }
        return Result.ok("token", token);
    }
}
