def test_dev_origin_accepts_profile_header(client):
    response = client.options(
        "/api/content/decide",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-profile-id",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "x-profile-id" in response.headers["access-control-allow-headers"].lower()


def test_other_origins_are_not_allowed(client):
    response = client.get("/api/users", headers={"Origin": "https://example.com"})
    assert "access-control-allow-origin" not in response.headers
