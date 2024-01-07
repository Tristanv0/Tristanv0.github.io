## My portfolio webpage created using the React framework!

https://tristanv0.github.io/

### How to commit changes to your repo and GitHub Pages

#### 1. Add your changes
```
git add .
```
#### 2. Commit your changes with a message
```
git commit -m "{message}"
```
- replace {message} with the changes you made
#### 3. Push your changes onto your GitHub repository
```
git push
```
#### 4.
```
git fetch origin gh-pages
```
#### 5. 
```
git checkout gh-pages
```
#### 6. 
```
git pull
```
#### 7. 
```
git checkout main
```
#### 8. Publish your changes onto GitHub Pages
```
npm run deploy -- -m "{message}"
```
- replace {message} with the same message from step 2

Some useful Git commands:

`git log` : View all commits on your repository -- make sure you are looking in the right branch (`git checkout {branch}`)
`git status -s` : View list of all modified files `-s` makes it more readable
`git add <file1> <file2> ...` : Add specific files 
`git diff --cached --name-only` : View list of all files added to staging (all files added with git add that has not been committed)
`git reset HEAD <file>` : Remove a file from staging
`git checkout <commit_id> -- path/to/your/file` : view previous versions of your repo based on the commit id found from `git log`

You have successfully published your changes onto GitHub Pages!
