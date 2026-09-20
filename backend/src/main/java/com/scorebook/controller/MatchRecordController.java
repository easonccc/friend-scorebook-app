package com.scorebook.controller;

import com.scorebook.common.Result;
import com.scorebook.entity.MatchRecord;
import com.scorebook.interceptor.LoginInterceptor;
import com.scorebook.service.MatchRecordService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 比赛记录接口（全部需登录）。
 * 对应原云函数 record 的 list/add/update/delete。
 * 所有写操作都在 Service 内部校验「当前用户是否为该空间成员」。
 */
@RestController
@RequestMapping("/api/match")
public class MatchRecordController {

    private final MatchRecordService matchService;

    public MatchRecordController(MatchRecordService matchService) {
        this.matchService = matchService;
    }

    /** 列出某空间的比赛记录（倒序）。 */
    @GetMapping("/list")
    public Result list(HttpServletRequest request, @RequestParam Long spaceId) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        List<MatchRecord> list = matchService.list(openid, spaceId);
        return Result.ok("list", list);
    }

    /** 新增一场比赛。 */
    @PostMapping("/create")
    public Result create(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        MatchRecord r = matchService.add(
                openid,
                toLong(body.get("spaceId")),
                (String) body.get("type"),
                toLong(body.get("time")),
                (String) body.get("loc"),
                toInt(body.get("duration")),
                toInt(body.get("a")),
                toInt(body.get("b")));
        return Result.ok("record", r);
    }

    /** 编辑一场比赛。 */
    @PutMapping("/{id}")
    public Result update(HttpServletRequest request, @PathVariable Long id,
                        @RequestBody Map<String, Object> body) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        MatchRecord r = matchService.update(
                openid, id,
                (String) body.get("type"),
                toLong(body.get("time")),
                (String) body.get("loc"),
                toInt(body.get("duration")),
                toInt(body.get("a")),
                toInt(body.get("b")));
        return Result.ok("record", r);
    }

    /** 删除一场比赛。 */
    @DeleteMapping("/{id}")
    public Result delete(HttpServletRequest request, @PathVariable Long id) {
        String openid = (String) request.getAttribute(LoginInterceptor.OPENID_ATTR);
        matchService.delete(openid, id);
        return Result.ok();
    }

    /** JSON 数字统一转 Long（前端可能传 int 也可能传 long）。 */
    private Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(o.toString());
        } catch (Exception e) {
            return null;
        }
    }

    /** JSON 数字统一转 Integer。 */
    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(o.toString());
        } catch (Exception e) {
            return null;
        }
    }
}
