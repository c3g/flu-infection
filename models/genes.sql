/*
 * genes.sql
 * Copyright (C) 2020 romgrk <romgrk@arch>
 *
 * Distributed under terms of the MIT license.
 */

create table genes (
    id        text primary key,
    name      text,
    chrom     text,
    start     integer,
    end       integer,
    strand    character(1)
);

