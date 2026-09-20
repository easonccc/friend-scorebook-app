package com.scorebook.controller;

import com.scorebook.common.Result;
import com.scorebook.entity.UserSettings;
import com.scorebook.interceptor.LoginInterceptor;
import com.scorebook.service.UserSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户设置接口（全部需登录）。
 * 一人一条；GET 不存在时后端自动建默认条目，前端永远拿得到。
 */
@RestController
@RequestMapping("/api/settings")
public class UserSettingsController {

    private final UserSettingsService settingsService;

    public UserSettingsController(UserSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public Result get(HttpServletRequest request) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        return Result.ok("settings", settingsService.get(openid));
    }

    @PutMapping
    public Result update(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        String defaultType = (String) body.get("defaultType");
        Object ds = body.get("defaultSpaceId");
        String defaultSpaceId = ds == null ? null : ds.toString();
        Object ct = body.get("customTypes");
        List<String> customTypes = ct == null ? null : (List<String>) ct;
        return Result.ok("settings", settingsService.update(openid, defaultType, defaultSpaceId, customTypes));
    }
}
