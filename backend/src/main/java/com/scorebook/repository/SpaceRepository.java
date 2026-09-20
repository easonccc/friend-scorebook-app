package com.scorebook.repository;

import com.scorebook.entity.Space;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface SpaceRepository extends JpaRepository<Space, Long> {

    /** 邀请码全局唯一（schema.sql 也有唯一索引兜底） */
    Optional<Space> findByInviteCode(String inviteCode);

    /**
     * 列出「成员含某 openid」的所有空间。
     * members 是 MySQL JSON 列，用 JSON_CONTAINS 做「数组含某值」判断。
     * 第二个参数必须是一个合法的 JSON 字符串，所以用 CONCAT 拼出 "openid"。
     */
    @Query(value = "SELECT * FROM spaces WHERE JSON_CONTAINS(members, CONCAT('\"', :oid, '\"'))", nativeQuery = true)
    List<Space> findByMember(String oid);
}
