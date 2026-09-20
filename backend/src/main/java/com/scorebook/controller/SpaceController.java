package com.scorebook.controller;

import com.scorebook.common.Result;
import com.scorebook.entity.Space;
import com.scorebook.interceptor.LoginInterceptor;
import com.scorebook.service.SpaceService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 比赛空间接口（全部需登录）。
 * 对应原云函数 createSpace / joinSpace / getSpaces / updateSpace。
 */
@RestController
@RequestMapping("/api/space")
public class SpaceController {

    private final SpaceService spaceService;

    public SpaceController(SpaceService spaceService) {
        this.spaceService = spaceService;
    }

    /** 创建空间：创建者即为成员 A，返回带邀请码的空间。 */
    @PostMapping("/create")
    public Result create(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        Space s = spaceService.create(
                openid,
                (String) body.get("name"),
                (String) body.get("playerAName"),
                (String) body.get("playerBName"));
        return Result.ok("space", s);
    }

    /** 凭邀请码加入空间。 */
    @PostMapping("/join")
    public Result join(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        Space s = spaceService.join(openid, (String) body.get("inviteCode"));
        return Result.ok("space", s);
    }

    /** 列出我参与的所有空间。 */
    @GetMapping("/list")
    public Result list(HttpServletRequest request) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        List<Space> spaces = spaceService.listMine(openid);
        return Result.ok("spaces", spaces);
    }

    /** 取单个空间详情（需成员）。 */
    @GetMapping("/{id}")
    public Result get(HttpServletRequest request, @PathVariable Long id) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        return Result.ok("space", spaceService.get(openid, id));
    }

    /** 修改双方名字（需成员）。 */
    @PutMapping("/{id}")
    public Result update(HttpServletRequest request, @PathVariable Long id,
                        @RequestBody Map<String, Object> body) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        Space s = spaceService.update(
                openid, id,
                (String) body.get("playerAName"),
                (String) body.get("playerBName"));
        return Result.ok("space", s);
    }
}
