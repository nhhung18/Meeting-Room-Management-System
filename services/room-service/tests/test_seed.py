from scripts.seed import SEED_ROOMS

VALID_STATUSES = {"AVAILABLE", "MAINTENANCE", "ARCHIVED"}


def test_seed_rooms_not_empty():
    assert len(SEED_ROOMS) >= 10


def test_all_names_unique():
    names = [r["name"] for r in SEED_ROOMS]
    assert len(names) == len(set(names))


def test_all_capacities_positive():
    for r in SEED_ROOMS:
        assert r["capacity"] > 0, f"{r['name']} has capacity {r['capacity']}"


def test_all_statuses_valid():
    for r in SEED_ROOMS:
        assert r["status"] in VALID_STATUSES, f"{r['name']} has status {r['status']}"


def test_equipment_is_list_of_strings():
    for r in SEED_ROOMS:
        assert isinstance(r["equipment"], list)
        for item in r["equipment"]:
            assert isinstance(item, str)


def test_no_duplicate_equipment_per_room():
    for r in SEED_ROOMS:
        assert len(r["equipment"]) == len(set(r["equipment"])), r["name"]


def test_required_fields_present():
    required = {"name", "capacity", "status", "equipment"}
    for r in SEED_ROOMS:
        assert required.issubset(r.keys()), f"{r['name']} missing {required - r.keys()}"
