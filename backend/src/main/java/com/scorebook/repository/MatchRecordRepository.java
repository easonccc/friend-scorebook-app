package com.scorebook.repository;

import com.scorebook.entity.MatchRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MatchRecordRepository extends JpaRepository<MatchRecord, Long> {

    /** 某空间的全部记录，按比赛时间倒序（最新的在前） */
    List<MatchRecord> findBySpaceIdOrderByTimeDesc(Long spaceId);
}
