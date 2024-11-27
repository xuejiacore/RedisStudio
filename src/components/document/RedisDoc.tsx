import React, {forwardRef} from "react";

const DEMO_DOC = "---\n" +
    "acl_categories:\n" +
    "- '@keyspace'\n" +
    "- '@write'\n" +
    "- '@fast'\n" +
    "arguments:\n" +
    "- display_text: key\n" +
    "  key_spec_index: 0\n" +
    "  name: key\n" +
    "  type: key\n" +
    "- display_text: seconds\n" +
    "  name: seconds\n" +
    "  type: integer\n" +
    "- arguments:\n" +
    "  - display_text: nx\n" +
    "    name: nx\n" +
    "    token: NX\n" +
    "    type: pure-token\n" +
    "  - display_text: xx\n" +
    "    name: xx\n" +
    "    token: XX\n" +
    "    type: pure-token\n" +
    "  - display_text: gt\n" +
    "    name: gt\n" +
    "    token: GT\n" +
    "    type: pure-token\n" +
    "  - display_text: lt\n" +
    "    name: lt\n" +
    "    token: LT\n" +
    "    type: pure-token\n" +
    "  name: condition\n" +
    "  optional: true\n" +
    "  since: 7.0.0\n" +
    "  type: oneof\n" +
    "arity: -3\n" +
    "categories:\n" +
    "- docs\n" +
    "- develop\n" +
    "- stack\n" +
    "- oss\n" +
    "- rs\n" +
    "- rc\n" +
    "- oss\n" +
    "- kubernetes\n" +
    "- clients\n" +
    "command_flags:\n" +
    "- write\n" +
    "- fast\n" +
    "complexity: O(1)\n" +
    "description: Sets the expiration time of a key in seconds.\n" +
    "group: generic\n" +
    "hidden: false\n" +
    "history:\n" +
    "- - 7.0.0\n" +
    "  - 'Added options: `NX`, `XX`, `GT` and `LT`.'\n" +
    "key_specs:\n" +
    "- RW: true\n" +
    "  begin_search:\n" +
    "    spec:\n" +
    "      index: 1\n" +
    "    type: index\n" +
    "  find_keys:\n" +
    "    spec:\n" +
    "      keystep: 1\n" +
    "      lastkey: 0\n" +
    "      limit: 0\n" +
    "    type: range\n" +
    "  update: true\n" +
    "linkTitle: EXPIRE\n" +
    "since: 1.0.0\n" +
    "summary: Sets the expiration time of a key in seconds.\n" +
    "syntax_fmt: EXPIRE key seconds [NX | XX | GT | LT]\n" +
    "syntax_str: seconds [NX | XX | GT | LT]\n" +
    "title: EXPIRE\n" +
    "---\n" +
    "Set a timeout on `key`.\n" +
    "After the timeout has expired, the key will automatically be deleted.\n" +
    "A key with an associated timeout is often said to be _volatile_ in Redis\n" +
    "terminology.\n" +
    "\n" +
    "The timeout will only be cleared by commands that delete or overwrite the\n" +
    "contents of the key, including [`DEL`]({{< relref \"/commands/del\" >}}), [`SET`]({{< relref \"/commands/set\" >}}), [`GETSET`]({{< relref \"/commands/getset\" >}}) and all the `*STORE`\n" +
    "commands.\n" +
    "This means that all the operations that conceptually _alter_ the value stored at\n" +
    "the key without replacing it with a new one will leave the timeout untouched.\n" +
    "For instance, incrementing the value of a key with [`INCR`]({{< relref \"/commands/incr\" >}}), pushing a new value\n" +
    "into a list with [`LPUSH`]({{< relref \"/commands/lpush\" >}}), or altering the field value of a hash with [`HSET`]({{< relref \"/commands/hset\" >}}) are\n" +
    "all operations that will leave the timeout untouched.\n" +
    "\n" +
    "The timeout can also be cleared, turning the key back into a persistent key,\n" +
    "using the [`PERSIST`]({{< relref \"/commands/persist\" >}}) command.\n" +
    "\n" +
    "If a key is renamed with [`RENAME`]({{< relref \"/commands/rename\" >}}), the associated time to live is transferred to\n" +
    "the new key name.\n" +
    "\n" +
    "If a key is overwritten by [`RENAME`]({{< relref \"/commands/rename\" >}}), like in the case of an existing key `Key_A`\n" +
    "that is overwritten by a call like `RENAME Key_B Key_A`, it does not matter if\n" +
    "the original `Key_A` had a timeout associated or not, the new key `Key_A` will\n" +
    "inherit all the characteristics of `Key_B`.\n" +
    "\n" +
    "Note that calling `EXPIRE`/[`PEXPIRE`]({{< relref \"/commands/pexpire\" >}}) with a non-positive timeout or\n" +
    "[`EXPIREAT`]({{< relref \"/commands/expireat\" >}})/[`PEXPIREAT`]({{< relref \"/commands/pexpireat\" >}}) with a time in the past will result in the key being\n" +
    "[deleted][del] rather than expired (accordingly, the emitted [key event][ntf]\n" +
    "will be `del`, not `expired`).\n" +
    "\n" +
    "[del]: /commands/del\n" +
    "[ntf]: /develop/use/keyspace-notifications\n" +
    "\n" +
    "## Options\n" +
    "\n" +
    "The `EXPIRE` command supports a set of options:\n" +
    "\n" +
    "* `NX` -- Set expiry only when the key has no expiry\n" +
    "* `XX` -- Set expiry only when the key has an existing expiry\n" +
    "* `GT` -- Set expiry only when the new expiry is greater than current one\n" +
    "* `LT` -- Set expiry only when the new expiry is less than current one\n" +
    "\n" +
    "A non-volatile key is treated as an infinite TTL for the purpose of `GT` and `LT`.\n" +
    "The `GT`, `LT` and `NX` options are mutually exclusive.\n" +
    "\n" +
    "## Refreshing expires\n" +
    "\n" +
    "It is possible to call `EXPIRE` using as argument a key that already has an\n" +
    "existing expire set.\n" +
    "In this case the time to live of a key is _updated_ to the new value.\n" +
    "There are many useful applications for this, an example is documented in the\n" +
    "_Navigation session_ pattern section below.\n" +
    "\n" +
    "## Differences in Redis prior 2.1.3\n" +
    "\n" +
    "In Redis versions prior **2.1.3** altering a key with an expire set using a\n" +
    "command altering its value had the effect of removing the key entirely.\n" +
    "This semantics was needed because of limitations in the replication layer that\n" +
    "are now fixed.\n" +
    "\n" +
    "`EXPIRE` would return 0 and not alter the timeout for a key with a timeout set.\n" +
    "\n" +
    "## Examples\n" +
    "\n" +
    "{{< clients-example cmds_generic expire >}}\n" +
    "> SET mykey \"Hello\"\n" +
    "\"OK\"\n" +
    "> EXPIRE mykey 10\n" +
    "(integer) 1\n" +
    "> TTL mykey\n" +
    "(integer) 10\n" +
    "> SET mykey \"Hello World\"\n" +
    "\"OK\"\n" +
    "> TTL mykey\n" +
    "(integer) -1\n" +
    "> EXPIRE mykey 10 XX\n" +
    "(integer) 0\n" +
    "> TTL mykey\n" +
    "(integer) -1\n" +
    "> EXPIRE mykey 10 NX\n" +
    "(integer) 1\n" +
    "> TTL mykey\n" +
    "(integer) 10\n" +
    "{{< /clients-example >}}\n" +
    "\n" +
    "Give these commands a try in the interactive console:\n" +
    "\n" +
    "{{% redis-cli %}}\n" +
    "SET mykey \"Hello\"\n" +
    "EXPIRE mykey 10\n" +
    "TTL mykey\n" +
    "SET mykey \"Hello World\"\n" +
    "TTL mykey\n" +
    "EXPIRE mykey 10 XX\n" +
    "TTL mykey\n" +
    "EXPIRE mykey 10 NX\n" +
    "TTL mykey\n" +
    "{{% /redis-cli %}}\n" +
    "\n" +
    "\n" +
    "## Pattern: Navigation session\n" +
    "\n" +
    "Imagine you have a web service and you are interested in the latest N pages\n" +
    "_recently_ visited by your users, such that each adjacent page view was not\n" +
    "performed more than 60 seconds after the previous.\n" +
    "Conceptually you may consider this set of page views as a _Navigation session_\n" +
    "of your user, that may contain interesting information about what kind of\n" +
    "products he or she is looking for currently, so that you can recommend related\n" +
    "products.\n" +
    "\n" +
    "You can easily model this pattern in Redis using the following strategy: every\n" +
    "time the user does a page view you call the following commands:\n" +
    "\n" +
    "```\n" +
    "MULTI\n" +
    "RPUSH pagewviews.user:<userid> http://.....\n" +
    "EXPIRE pagewviews.user:<userid> 60\n" +
    "EXEC\n" +
    "```\n" +
    "\n" +
    "If the user will be idle more than 60 seconds, the key will be deleted and only\n" +
    "subsequent page views that have less than 60 seconds of difference will be\n" +
    "recorded.\n" +
    "\n" +
    "This pattern is easily modified to use counters using [`INCR`]({{< relref \"/commands/incr\" >}}) instead of lists\n" +
    "using [`RPUSH`]({{< relref \"/commands/rpush\" >}}).\n" +
    "\n" +
    "## Appendix: Redis expires\n" +
    "\n" +
    "### Keys with an expire\n" +
    "\n" +
    "Normally Redis keys are created without an associated time to live.\n" +
    "The key will simply live forever, unless it is removed by the user in an\n" +
    "explicit way, for instance using the [`DEL`]({{< relref \"/commands/del\" >}}) command.\n" +
    "\n" +
    "The `EXPIRE` family of commands is able to associate an expire to a given key,\n" +
    "at the cost of some additional memory used by the key.\n" +
    "When a key has an expire set, Redis will make sure to remove the key when the\n" +
    "specified amount of time elapsed.\n" +
    "\n" +
    "The key time to live can be updated or entirely removed using the `EXPIRE` and\n" +
    "[`PERSIST`]({{< relref \"/commands/persist\" >}}) command (or other strictly related commands).\n" +
    "\n" +
    "### Expire accuracy\n" +
    "\n" +
    "In Redis 2.4 the expire might not be pin-point accurate, and it could be between\n" +
    "zero to one seconds out.\n" +
    "\n" +
    "Since Redis 2.6 the expire error is from 0 to 1 milliseconds.\n" +
    "\n" +
    "### Expires and persistence\n" +
    "\n" +
    "Keys expiring information is stored as absolute Unix timestamps (in milliseconds\n" +
    "in case of Redis version 2.6 or greater).\n" +
    "This means that the time is flowing even when the Redis instance is not active.\n" +
    "\n" +
    "For expires to work well, the computer time must be taken stable.\n" +
    "If you move an RDB file from two computers with a big desync in their clocks,\n" +
    "funny things may happen (like all the keys loaded to be expired at loading\n" +
    "time).\n" +
    "\n" +
    "Even running instances will always check the computer clock, so for instance if\n" +
    "you set a key with a time to live of 1000 seconds, and then set your computer\n" +
    "time 2000 seconds in the future, the key will be expired immediately, instead of\n" +
    "lasting for 1000 seconds.\n" +
    "\n" +
    "### How Redis expires keys\n" +
    "\n" +
    "Redis keys are expired in two ways: a passive way and an active way.\n" +
    "\n" +
    "A key is passively expired when a client tries to access it and the\n" +
    "key is timed out.\n" +
    "\n" +
    "However, this is not enough as there are expired keys that will never be\n" +
    "accessed again.\n" +
    "These keys should be expired anyway, so periodically, Redis tests a few keys at\n" +
    "random amongst the set of keys with an expiration.\n" +
    "All the keys that are already expired are deleted from the keyspace.\n" +
    "\n" +
    "### How expires are handled in the replication link and AOF file\n" +
    "\n" +
    "In order to obtain a correct behavior without sacrificing consistency, when a\n" +
    "key expires, a [`DEL`]({{< relref \"/commands/del\" >}}) operation is synthesized in both the AOF file and gains all\n" +
    "the attached replicas nodes.\n" +
    "This way the expiration process is centralized in the master instance, and there\n" +
    "is no chance of consistency errors.\n" +
    "\n" +
    "However while the replicas connected to a master will not expire keys\n" +
    "independently (but will wait for the [`DEL`]({{< relref \"/commands/del\" >}}) coming from the master), they'll\n" +
    "still take the full state of the expires existing in the dataset, so when a\n" +
    "replica is elected to master it will be able to expire the keys independently,\n" +
    "fully acting as a master.\n";

export interface RedisDocRef {

}

interface RedisDocProps {
    title: string;
    body: string;
    path: string[];
}

const RedisDoc: React.FC<RedisDocProps> = forwardRef<RedisDocRef | undefined, RedisDocProps>((props, ref) => {
    // ---(.|\n)*---
    //   acl_categories:((\n)-.*)+
    //   arguments:((\n)-.*)+
    //   since: [0-9.]+
    return (
        <>
        </>
    )
});

RedisDoc.displayName = "RedisDoc";
export default RedisDoc;