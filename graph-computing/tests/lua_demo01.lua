#!/usr/local/bin/lua
function echo(param)
    for i, v in ipairs(param) do
        print(i .. "\t" .. v)
    end
    print("this is echo function")
end

echo({ "test", "test2" })

my_table = {}
my_table["id"] = "id01"
my_table["name"] = "name01"
my_table["age"] = 30

print(my_table.id .. "\t" .. my_table.age .. "\t" .. my_table.name)

function hset(key, field, value)
    print("hset " .. key .. " " .. field .. " " .. value)
end

hset("testkey0001", "field001", "value");