.PHONY: fmt lint test cover cover-html doc doc-report run clean

fmt:
	gofmt -l -w .

lint:
	golangci-lint run ./...

test:
	go test ./... -v

cover:
	go test ./... -coverprofile=coverage.out
	go tool cover -func=coverage.out

cover-html: cover
	go tool cover -html=coverage.out -o coverage.html

doc:
	gomarkdoc ./...

doc-report:
	gomarkdoc --output '{{.Dir}}/API.md' ./...

run:
	go run .

clean:
	rm -f coverage.out coverage.html
	find . -name API.md -delete
