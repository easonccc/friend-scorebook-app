package com.scorebook.service;

import com.scorebook.entity.Space;
import com.scorebook.repository.SpaceRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 比赛空间业务逻辑（对应原云函数 createSpace / joinSpace / getSpaces / updateSpace）。
 *
 * 安全要点：
 *  - 邀请码必须在服务端生成且全局唯一（前端各自随机可能撞码），因此这里用「重试 + 唯一索引」双保险。
 *  - 加入空间必须由服务端校验「邀请码正确 + 未满 2 人」，否则任何人都能把自己塞进别人的空间。
 *  - 成员判断只看 spaces.members 数组，且「是不是成员」只在这里（服务端）算，前端无法伪造。
 */
@Service
public class SpaceService {

    private final SpaceRepository repo;

    /** 邀请码字符集：去掉易混淆的 0/O/1/I，只留 6 位大写字母+数字 */
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public SpaceService(SpaceRepository repo) {
        this.repo = repo;
    }

    /** 创建空间：生成唯一邀请码，创建者自动成为成员 A（playerAName）。 */
    public Space create(String openid, String name, String aName, String bName) {
        String n = clip(name, 12, "我们的空间");
        String pa = clip(aName, 8, "我");
        String pb = clip(bName, 8, "小晗子");

        Space s = new Space();
        s.setName(n);
        s.setInviteCode(genUniqueCode());
        s.setCreatorOpenid(openid);
        s.setPlayerAName(pa);
        s.setPlayerBName(pb);
        // 用可变 List，后续 join 时直接 add；避免 List.of 的不可变列表
        s.setMembers(new ArrayList<>(List.of(openid)));
        s.setCreatedAt(LocalDateTime.now());
        return repo.save(s);
    }

    /** 通过邀请码加入：已满 2 人拒绝；已加入则幂等返回原空间。 */
    public Space join(String openid, String code) {
        String c = code == null ? "" : code.trim().toUpperCase();
        if (c.length() != 6) {
            throw new IllegalArgumentException("邀请码是 6 位，请核对");
        }
        Space s = repo.findByInviteCode(c)
                .orElseThrow(() -> new IllegalArgumentException("邀请码不存在，请核对"));

        if (!s.getMembers().contains(openid)) {
            if (s.getMembers().size() >= 2) {
                throw new IllegalArgumentException("这个空间已经有两个人啦");
            }
            s.getMembers().add(openid);
            s = repo.save(s);
        }
        return s;
    }

    /** 列出当前用户参与的所有空间（members 数组含该 openid）。 */
    public List<Space> listMine(String openid) {
        return repo.findByMember(openid);
    }

    /** 取单个空间（必须是成员，否则拒绝）。 */
    public Space get(String openid, Long id) {
        Space s = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("空间不存在"));
        requireMember(s, openid);
        return s;
    }

    /** 修改双方名字（仅成员可改）。 */
    public Space update(String openid, Long id, String aName, String bName) {
        Space s = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("空间不存在"));
        requireMember(s, openid);
        s.setPlayerAName(clip(aName, 8, "我"));
        s.setPlayerBName(clip(bName, 8, "小晗子"));
        return repo.save(s);
    }

    /** 判断某 openid 是否某空间成员（供比赛记录接口复用）。 */
    public boolean isMember(Long spaceId, String openid) {
        return repo.findById(spaceId)
                .map(s -> s.getMembers().contains(openid))
                .orElse(false);
    }

    private void requireMember(Space s, String openid) {
        if (!s.getMembers().contains(openid)) {
            throw new IllegalArgumentException("你不是这个空间的成员");
        }
    }

    /** 裁剪长度；空则用默认值 */
    private String clip(String v, int max, String def) {
        String s = (v == null ? "" : v).trim();
        if (s.length() > max) {
            s = s.substring(0, max);
        }
        return s.isEmpty() ? def : s;
    }

    /** 生成不重复的 6 位邀请码（最多重试 10 次，命中唯一索引兜底）。 */
    private String genUniqueCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_CHARS.charAt((int) (Math.random() * CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (repo.findByInviteCode(code).isEmpty()) {
                return code;
            }
        }
        throw new RuntimeException("生成邀请码失败，请重试");
    }
}
