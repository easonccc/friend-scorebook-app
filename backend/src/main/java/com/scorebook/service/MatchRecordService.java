package com.scorebook.service;

import com.scorebook.entity.MatchRecord;
import com.scorebook.entity.Space;
import com.scorebook.repository.MatchRecordRepository;
import com.scorebook.repository.SpaceRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 比赛记录业务逻辑（对应原云函数 record 的 list/add/update/delete）。
 *
 * 关键安全点：match_records 表本身不能跨表校验「调用者是不是该空间成员」，
 * 所以每次读写前都先查 spaces.members 是否含当前 openid——成员校验只在服务端发生。
 */
@Service
public class MatchRecordService {

    private final MatchRecordRepository repo;
    private final SpaceRepository spaceRepo;

    public MatchRecordService(MatchRecordRepository repo, SpaceRepository spaceRepo) {
        this.repo = repo;
        this.spaceRepo = spaceRepo;
    }

    /** 拉某空间全部记录（倒序）。需成员身份。 */
    public List<MatchRecord> list(String openid, Long spaceId) {
        requireMember(spaceId, openid);
        return repo.findBySpaceIdOrderByTimeDesc(spaceId);
    }

    /** 新增一场比赛。winner 由比分自动算：a>b→me，a<b→friend，相等→draw。 */
    public MatchRecord add(String openid, Long spaceId, String type, Long time,
                           String loc, Integer duration, Integer a, Integer b) {
        requireMember(spaceId, openid);
        MatchRecord r = new MatchRecord();
        fill(r, spaceId, type, time, loc, duration, a, b);
        r.setCreatorOpenid(openid);
        r.setCreatedAt(LocalDateTime.now());
        r.setUpdatedAt(LocalDateTime.now());
        return repo.save(r);
    }

    /** 编辑一场比赛（仅成员可改）。 */
    public MatchRecord update(String openid, Long id, String type, Long time,
                              String loc, Integer duration, Integer a, Integer b) {
        MatchRecord r = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("记录不存在"));
        requireMember(r.getSpaceId(), openid);
        fill(r, r.getSpaceId(), type, time, loc, duration, a, b);
        r.setUpdatedAt(LocalDateTime.now());
        return repo.save(r);
    }

    /** 删除一场比赛（仅成员可删）。 */
    public void delete(String openid, Long id) {
        MatchRecord r = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("记录不存在"));
        requireMember(r.getSpaceId(), openid);
        repo.delete(r);
    }

    private void fill(MatchRecord r, Long spaceId, String type, Long time,
                      String loc, Integer duration, Integer a, Integer b) {
        r.setSpaceId(spaceId);
        r.setType(type == null || type.isBlank() ? "台球" : type.trim());
        r.setTime(time == null ? System.currentTimeMillis() : time);
        r.setLoc(loc == null ? "" : loc);
        r.setDuration(duration == null ? 0 : duration);
        int ia = a == null ? 0 : a;
        int ib = b == null ? 0 : b;
        r.setA(ia);
        r.setB(ib);
        r.setWinner(ia > ib ? "me" : ia < ib ? "friend" : "draw");
    }

    private void requireMember(Long spaceId, String openid) {
        Space s = spaceRepo.findById(spaceId)
                .orElseThrow(() -> new IllegalArgumentException("空间不存在"));
        if (!s.getMembers().contains(openid)) {
            throw new IllegalArgumentException("你不是该空间成员");
        }
    }
}
